from pydantic import BaseModel
from tavily import TavilyClient

client = TavilyClient()


class SearchResult(BaseModel):
    title: str
    url: str
    content: str
    raw_response: dict | None = None


# takes query and returns tavily results
def search(query: str, max_results: int = 10) -> list[SearchResult]:
    results = client.search(query=query, max_results=max_results, search_depth="advanced")["results"]
    return [
        SearchResult(
            title=r["title"],
            url=r["url"],
            content=r["content"],
            raw_response=r,
        )
        for r in results
    ]
