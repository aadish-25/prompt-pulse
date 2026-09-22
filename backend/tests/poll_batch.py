import sys
sys.stdout.reconfigure(encoding="utf-8")
import time, json, urllib.request

def get(path):
    with urllib.request.urlopen(f"http://localhost:8000{path}") as r:
        return json.loads(r.read())

print("Polling batch 4 every 30s...")
for i in range(20):
    b = get("/batches/4")
    status = b["status"]
    completed = b["completed_runs"]
    total = b["total_runs"]
    failed = b["failed_runs"]
    print(f"  [{i*30}s] status={status}  completed={completed}/{total}  failed={failed}")
    if status in ("done", "failed"):
        print("Batch finished!")
        break
    time.sleep(30)
