import os
from pydantic import BaseModel
from tavily import TavilyClient
from tenacity import retry, stop_after_attempt, wait_exponential
from app.logger import logger, log_span


class SearchResult(BaseModel):
    title: str
    url: str
    content: str
    raw_response: dict | None = None


def get_tavily_client(api_key: str | None = None, is_demo: bool = False) -> TavilyClient:
    key = (api_key or "").strip()
    if not key and is_demo:
        key = os.environ.get("DEMO_TAVILY_API_KEY", "").strip()
    if not key:
        key = os.environ.get("TAVILY_API_KEY", "").strip()
    return TavilyClient(api_key=key)


# takes query and returns tavily results with retry on network/rate-limit errors
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def search(query: str, max_results: int = 10, api_key: str | None = None) -> list[SearchResult]:
    with log_span("tavily_search", query=query):
        client = get_tavily_client(api_key=api_key)
        raw_res = client.search(
            query=query, max_results=max_results, search_depth="advanced"
        )
        results = raw_res.get("results", [])
        logger.info(f"[TAVILY] Query '{query}' yielded {len(results)} search results")
        return [
            SearchResult(
                title=r.get("title", ""),
                url=r.get("url", ""),
                content=r.get("content", ""),
                raw_response=r,
            )
            for r in results
        ]
