# llm decides what to search, tavily searches it and gives results
import json
from datetime import date
from urllib.parse import urlparse
from groq import Groq
from app.services.search import search
from app.services.citations import extract_cited
from app.config import MAX_SEARCH_STEPS


client = Groq()
MODEL = "qwen/qwen3.8-27b"
MAX_STEPS = MAX_SEARCH_STEPS + 1


def build_system() -> str:
    return (
        f"Today's date is {date.today():%B %d, %Y}. "
        "Never add a year to a search query unless the user's question includes one and use the year according the usecase and not randomly based on cut-off date of training data. "
        "Answer using web search when you need current facts. "
        "Search results are numbered like [1], [2]. Cite the sources you used "
        "by number in square brackets, like [1][3], and use no other citation "
        "format. End your answer with a line: 'Sources used: 1, 3, 5'. "
        "Only cite numbers that appeared in search results."
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


def run_prompt(prompt: str) -> dict:
    queries: list[str] = []
    sources: list[dict] = []  # every unique result, in order; index + 1 = its number
    number_of: dict[str, int] = {}  # url -> its number
    messages = [
        {"role": "system", "content": build_system()},
        {"role": "user", "content": prompt},
    ]

    def web_search(query: str) -> str:
        queries.append(query)
        lines = []
        for r in search(query):
            url = r["url"]
            if url not in number_of:
                sources.append(
                    {
                        "title": r["title"],
                        "url": url,
                        "content": r["content"],
                        "domain": get_domain(url),
                    }
                )
                number_of[url] = len(sources)
            lines.append(f"[{number_of[url]}] {r['title']}\nURL: {url}\n{r['content']}")
        return "\n\n".join(lines) or "No results."

    answer = ""
    for step in range(MAX_STEPS):
        last = step == MAX_STEPS - 1
        if last:
            messages.append(
                {
                    "role": "user",
                    "content": "Searching is finished. Write your final answer now, "
                    "using only the sources you already have.",
                }
            )
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="none" if last else "auto",
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
        s["cited"] = i in cited

    return {"answer": answer, "queries": queries, "sources": sources, "model": MODEL}
