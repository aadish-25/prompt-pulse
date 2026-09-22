from dotenv import load_dotenv

load_dotenv()  # must come before importing llm, which creates the Groq client

from app.services.llm import run_prompt

r = run_prompt("best sport shoes in india")

print(r["answer"])
print("\nQUERIES:", r["queries"])
print("\nSOURCES:")
for i, s in enumerate(r["sources"], start=1):
    print(i, "CITED" if s["cited"] else "  -  ", s["domain"])
