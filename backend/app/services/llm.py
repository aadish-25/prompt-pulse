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
    resolve_llm,
)
from app.logger import logger, log_span

MAX_STEPS = MAX_SEARCH_STEPS + 1


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _chat_completion_with_retry(user_keys: dict[str, str] | None = None, **kwargs):
    raw_model = kwargs.get("model")
    client, clean_model = resolve_llm(raw_model, user_keys=user_keys)
    kwargs["model"] = clean_model
    if "max_tokens" not in kwargs:
        kwargs["max_tokens"] = 1500
    return client.chat.completions.create(**kwargs)


class LLMSource(BaseModel):
    title: str
    url: str
    content: str
    domain: str
    cited: bool = False
    raw_response: dict | None = None


class PromptResult(BaseModel):
    answer: str
    queries: list[str]
    sources: list[LLMSource]
    model: str
    forced_min_searches: bool


def build_system() -> str:
    return (
        f"Date: {date.today():%B %d, %Y}. You are a careful research assistant. "
        "Answer the user's question directly and use web search for current or externally verifiable facts. "
        "Do not invent sources, quotations, statistics, or citations. If the available evidence is incomplete, say so. "
        "Format the answer as clean Markdown: use concise headings when useful, short paragraphs, and lists for multiple items. "
        "After each factual claim supported by a search result, append its source reference in square brackets, e.g. [2]. "
        "Use only reference numbers that were actually supplied by the search tool. "
        "Ensure every factual claim is supported by inline bracket citations like [1] or [2]."
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


def run_prompt(
    prompt: str,
    model: str | None = None,
    user_keys: dict[str, str] | None = None,
) -> PromptResult:
    with log_span("run_prompt", prompt=prompt[:60], model=model or MODEL):
        # Preserve the provider prefix (OR:, GROQ:, DS:) until the request is routed.
        # Stripping it here silently sent every model through the OpenRouter fallback.
        active_model = (model or MODEL).strip()
        queries: list[str] = []
        sources: list[LLMSource] = []
        number_of: dict[str, int] = {}
        messages = [
            {"role": "system", "content": build_system()},
            {"role": "user", "content": prompt},
        ]

        tavily_key = (user_keys or {}).get("tavily")

        def web_search(query: str) -> str:
            queries.append(query)
            lines = []
            for r in search(query, api_key=tavily_key):
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

            logger.info(f"[AGENT LOOP] Step {step + 1}/{loop_limit} | Tool choice: {tool_choice} | Queries so far: {len(queries)}")
            response = _chat_completion_with_retry(
                user_keys=user_keys,
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
                q_text = args.get("query", "").strip()
                logger.info(f"[AGENT TOOL CALL] Executing web_search: '{q_text}'")
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": web_search(q_text),
                    }
                )

        cited = extract_cited(answer)
        for i, s in enumerate(sources, start=1):
            s.cited = i in cited

        logger.info(f"[PROMPT DONE] Extracted {len(sources)} sources, {sum(1 for s in sources if s.cited)} cited")
        return PromptResult(
            answer=answer,
            queries=queries,
            sources=sources,
            model=active_model,
            forced_min_searches=FORCE_MIN_SEARCHES,
        )
