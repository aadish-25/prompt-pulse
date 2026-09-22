import sys
sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv

load_dotenv()  # must come before importing llm, which creates the OpenAI client

from app.services.llm import run_prompt
from app.services.extraction import find_target_mentions, analyze_answer

brand_name = "boAt"
aliases = []

r = run_prompt("What are the best wireless earbuds under ₹2000 in India right now?")

print(r.answer)
print("\nQUERIES:", r.queries)
print("\nMODE: forced_min_searches =", r.forced_min_searches)
print("\nSOURCES:")
for i, s in enumerate(r.sources, start=1):
    print(i, "CITED" if s.cited else "  -  ", s.domain)

mentions = find_target_mentions(r.answer, brand_name, aliases)
analysis = analyze_answer(r.answer, brand_name)

print("\nTARGET MENTIONS:", mentions)
print("OTHER BRANDS (Compititors):", analysis.other_brands)
print("SENTIMENT:", analysis.target_sentiment)
print("REMARK:", analysis.target_remark)