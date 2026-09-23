# llm decides what to search, tavily searches it and gives results
import os
import json
from datetime import date
from urllib.parse import urlparse
from pydantic import BaseModel
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from app.services.search import search
from app.services.citations import extract_cited
from app.config import (
    MAX_SEARCH_STEPS,
    MODEL,
    FORCE_MIN_SEARCHES,
    MIN_SEARCHES,
    get_llm_client,
    normalize_model_for_provider,
)

def get_client():
    return get_llm_client()

MAX_STEPS = MAX_SEARCH_STEPS + 1


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _chat_completion_with_retry(**kwargs):
    raw_model = kwargs.get("model")
    from app.config import resolve_llm
    client, clean_model = resolve_llm(raw_model)
    kwargs["model"] = clean_model
    if "max_tokens" not in kwargs:
        kwargs["max_tokens"] = 1500
    return client.chat.completions.create(**kwargs)


class LLMSource(BaseModel):
    """One search result as seen by the LLM loop. Internal — not exposed via API."""
    title: str
    url: str
    content: str
    domain: str
    cited: bool = False
    raw_response: dict | None = None


class PromptResult(BaseModel):
    """Everything run_prompt returns. Internal — the API layer maps this to PromptExecutionOut."""
    answer: str
    queries: list[str]
    sources: list[LLMSource]
    model: str
    forced_min_searches: bool


def build_system() -> str:
    return (
        f"Date: {date.today():%B %d, %Y}. Answer using web search. "
        "After every factual claim from a search result, append its reference number in brackets, e.g. [2]. "
        "Use only [X] brackets. At the very end, append one line: 'CITED: 1, 2' listing all cited source numbers."
    )


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "search query"}
                },
                "required": ["query"],
            },
        },
    }
]


def get_domain(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def run_prompt(prompt: str, model: str | None = None) -> PromptResult:
    active_model = normalize_model_for_provider(model or MODEL)
    queries: list[str] = []
    sources: list[LLMSource] = []  # every unique result, in order; index + 1 = its number
    number_of: dict[str, int] = {}  # url -> its number
    messages = [
        {"role": "system", "content": build_system()},
        {"role": "user", "content": prompt},
    ]

    def web_search(query: str) -> str:
        queries.append(query)
        lines = []
        for r in search(query):
            url = r.url
            if url not in number_of:
                sources.append(
                    LLMSource(
                        title=r.title,
                        url=url,
                        content=r.content,
                        domain=get_domain(url),
                        raw_response=r.raw_response,
                    )
                )
                number_of[url] = len(sources)
            lines.append(f"[{number_of[url]}] {r.title}\nURL: {url}\n{r.content}")
        return "\n\n".join(lines) or "No results."

    answer = ""
    loop_limit = MAX_STEPS + (1 if FORCE_MIN_SEARCHES else 0)
    for step in range(loop_limit):
        at_natural_end = step == MAX_STEPS - 1
        at_hard_end = step == loop_limit - 1
        last = at_natural_end or at_hard_end

        # Three-way tool_choice priority:
        #   1. last step → "none"  (must write answer, no tool calls allowed)
        #   2. below MIN_SEARCHES floor → "required"  (must call at least one
        #      tool, so msg.tool_calls is never empty and the early-exit branch
        #      `not msg.tool_calls` cannot fire before the floor is reached)
        #   3. otherwise → "auto"  (model decides)
        if last:
            tool_choice = "none"
        elif FORCE_MIN_SEARCHES and len(queries) < MIN_SEARCHES:
            tool_choice = "required"
        else:
            tool_choice = "auto"

        if last:
            messages.append(
                {
                    "role": "user",
                    "content": "Searching is finished. Write your final answer now, "
                    "using only the sources you already have.",
                }
            )
        response = _chat_completion_with_retry(
            model=active_model,
            messages=messages,
            tools=TOOLS,
            tool_choice=tool_choice,
        )
        msg = response.choices[0].message

        if last or not msg.tool_calls:
            answer = msg.content or ""
            break

        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ],
            }
        )
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": web_search(args["query"]),
                }
            )

    # which sources did the answer actually cite?
    cited = extract_cited(answer)
    for i, s in enumerate(sources, start=1):
        s.cited = i in cited

    return PromptResult(
        answer=answer,
        queries=queries,
        sources=sources,
        model=active_model,
        forced_min_searches=FORCE_MIN_SEARCHES,
    )
