import sys
sys.stdout.reconfigure(encoding="utf-8")
import json, urllib.request

BASE = "http://localhost:8000"
PROJECT_ID = 4
BATCH_ID = 4

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())

def divider(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

# ── 1. GET /batches/4 ───────────────────────────────────────────────────────
divider("GET /batches/4  (batch status)")
b = get(f"/batches/{BATCH_ID}")
print(json.dumps(b, indent=2))

# ── 2. GET /batches/4/runs ──────────────────────────────────────────────────
divider("GET /batches/4/runs  (all executions — high level)")
runs = get(f"/batches/{BATCH_ID}/runs")
for ex in runs:
    prompt_snip = "(unknown)"
    cited_count = sum(1 for s in ex.get("web_search_results", []) if s["cited"])
    total_sources = len(ex.get("web_search_results", []))
    queries = [q["query"] for q in ex.get("search_queries", [])]
    analysis = ex.get("analysis") or {}
    mentions = ex.get("brand_mentions", [])
    print(f"\n  Execution #{ex['id']} | round={ex['round']} | status={ex['status']} | {ex['duration_ms']}ms")
    print(f"  Model:      {ex['model']}")
    print(f"  Queries:    {queries}")
    print(f"  Sources:    {total_sources} total, {cited_count} cited")
    print(f"  Amul mentions: {len(mentions)}")
    print(f"  Sentiment:  {analysis.get('target_sentiment', 'N/A')}")
    print(f"  Remark:     {analysis.get('target_remark', 'N/A')}")
    print(f"  Competitors:{analysis.get('other_brands', [])}")
    print(f"  Answer preview: {(ex.get('raw_answer') or '')[:200].strip()}...")

# ── 3. GET /projects/4/results ──────────────────────────────────────────────
divider("GET /projects/4/results  (same executions via project)")
results = get(f"/projects/{PROJECT_ID}/results")
print(f"  Total executions returned: {len(results)}")
print(f"  IDs: {[r['id'] for r in results]}")

# ── 4. GET /projects/4/summary ──────────────────────────────────────────────
divider("GET /projects/4/summary  (brand visibility & competitors)")
summary = get(f"/projects/{PROJECT_ID}/summary")
print(json.dumps(summary, indent=2))

# ── 5. GET /projects/4/citations ────────────────────────────────────────────
divider("GET /projects/4/citations  (domain citation audit)")
citations = get(f"/projects/{PROJECT_ID}/citations")
print(f"  {'Domain':<35} {'Retrieved':>9}  {'Cited':>5}")
print(f"  {'-'*35} {'-'*9}  {'-'*5}")
for c in citations[:20]:
    print(f"  {c['domain']:<35} {c['retrieved']:>9}  {c['cited']:>5}")
if len(citations) > 20:
    print(f"  ... and {len(citations)-20} more domains")

# ── 6. Spot-check raw_response on first cited source ───────────────────────
divider("raw_response spot-check (first cited WebSearchResult)")
first_run = runs[0]
cited_sources = [s for s in first_run.get("web_search_results", []) if s["cited"]]
if cited_sources:
    s = cited_sources[0]
    print(f"  URL:   {s['url']}")
    print(f"  Domain:{s['domain']}")
    rr = s.get("raw_response") or {}
    print(f"  raw_response keys: {list(rr.keys())}")
    print(f"  score (Tavily relevance): {rr.get('score', 'N/A')}")
else:
    print("  No cited sources in first execution.")

print("\n\nAll endpoints checked.")
