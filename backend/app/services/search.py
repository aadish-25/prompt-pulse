from pydantic import BaseModel
from tavily import TavilyClient
from tenacity import retry, stop_after_attempt, wait_exponential

client = TavilyClient()


class SearchResult(BaseModel):
    title: str
    url: str
    content: str
    raw_response: dict | None = None


# takes query and returns tavily results with retry on network/rate-limit errors
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def search(query: str, max_results: int = 5) -> list[SearchResult]:
    results = client.search(
        query=query, max_results=max_results, search_depth="advanced"
    )["results"]
    return [
        SearchResult(
            title=r["title"],
            url=r["url"],
            content=r["content"][:450] if r.get("content") else "",
            raw_response=r,
        )
        for r in results
    ]
