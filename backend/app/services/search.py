from tavily import TavilyClient

client = TavilyClient()


# takes query and returns tavily results
def search(query: str, max_results: int = 5) -> list[dict]:
    results = client.search(query=query, max_results=max_results)["results"]
    return [
        {"title": r["title"], "url": r["url"], "content": r["content"]} for r in results
    ]
