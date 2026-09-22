import sys
sys.stdout.reconfigure(encoding="utf-8")
import urllib.request
import json

# Test 1: Generate Variants without any seed topic
print("=== 1. Test POST /projects/4/prompts/generate-variants ===")
url = "http://localhost:8000/projects/4/prompts/generate-variants"
payload = {"count": 3}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(req) as r:
    res = json.loads(r.read())
    print(f"Target Brand: {res['brand_name']}\n")
    generated_texts = []
    for i, v in enumerate(res["variants"], 1):
        print(f"[{i}] \"{v['text']}\"")
        print(f"    Intent:    {v['intent_category']}")
        print(f"    Rationale: {v['rationale']}\n")
        generated_texts.append(v["text"])

# Test 2: Bulk Add the generated variants
print("\n=== 2. Test POST /projects/4/prompts/bulk ===")
bulk_url = "http://localhost:8000/projects/4/prompts/bulk"
bulk_payload = {"texts": generated_texts[:2]}

bulk_req = urllib.request.Request(
    bulk_url,
    data=json.dumps(bulk_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

added_ids = []
with urllib.request.urlopen(bulk_req) as r:
    bulk_res = json.loads(r.read())
    print(f"Successfully added {len(bulk_res)} prompts in bulk:")
    for p in bulk_res:
        print(f"  ID #{p['id']}: \"{p['text']}\"")
        added_ids.append(p['id'])

# Cleanup: Delete the newly added test prompts
print("\n=== 3. Clean up test prompts via DELETE ===")
for pid in added_ids:
    del_req = urllib.request.Request(f"http://localhost:8000/prompts/{pid}", method="DELETE")
    with urllib.request.urlopen(del_req) as del_res:
        print(f"  Deleted prompt #{pid} (status: {del_res.status})")

# Test 4: Get supported models
print("\n=== 4. Test GET /models ===")
with urllib.request.urlopen("http://localhost:8000/models") as r:
    models_res = json.loads(r.read())
    print("Default Model:", models_res["default_model"])
    print("Supported Models:", models_res["supported_models"])

print("\nAll integration checks passed!")
