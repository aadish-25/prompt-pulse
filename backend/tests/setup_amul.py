import sys
sys.stdout.reconfigure(encoding="utf-8")
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data,
                                  headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())

# ── 1. Create project ──────────────────────────────────────────────────────
project = post("/projects", {
    "brand_name": "Amul",
    "domain": ["amul.com"],
    "aliases": ["Amul Dairy", "GCMMF"],
    "competitors": ["Nandini", "Mother Dairy", "Verka", "Milma"]
})
pid = project["id"]
print(f"Project created → id={pid}, brand={project['brand_name']}")

# ── 2. Add 5 prompts ────────────────────────────────────────────────────────
prompts_text = [
    "Which butter brand is best for everyday cooking in India?",
    "What is the most popular ice cream brand in India right now?",
    "Which Indian dairy brand is most trusted for milk and milk products?",
    "Best paneer brand available in Indian supermarkets in 2026?",
    "Which cheese brand do professional chefs in India prefer?",
]

prompt_ids = []
for text in prompts_text:
    p = post(f"/projects/{pid}/prompts", {"text": text})
    prompt_ids.append(p["id"])
    print(f"  Prompt #{p['id']} added")

# ── 3. Start batch (1 round) ────────────────────────────────────────────────
batch = post(f"/projects/{pid}/runs", {"rounds": 1})
bid = batch["id"]
print(f"\nBatch started → id={bid}, total_runs={batch['total_runs']}, status={batch['status']}")
print(f"\nProject ID: {pid}  |  Batch ID: {bid}")
print("Run: uv run python setup_amul.py  (already done)")
print("Now poll:  irm http://localhost:8000/batches/{bid}")
