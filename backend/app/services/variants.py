import os
from pydantic import BaseModel
from openai import OpenAI
from app.config import MODEL, DEFAULT_VARIANT_COUNT, MAX_VARIANT_COUNT

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)


class PromptVariant(BaseModel):
    text: str
    intent_category: str
    rationale: str


class VariantGenerationResponse(BaseModel):
    variants: list[PromptVariant]


SYSTEM_PROMPT = """You generate realistic search prompts that real buyers type into AI assistants (ChatGPT, Perplexity, Gemini) when discovering and comparing options in a market — for Generative Engine Optimization (GEO) tracking.

TARGET BRAND (for context only — see Rule 1): {brand_name}
DOMAINS: {domains}
KNOWN COMPETITORS: {competitors}
ALIASES: {aliases}

STEP 1 — Identify the category this brand competes in, and the 4-5 criteria real buyers in that exact category actually weigh (e.g. a laptop buyer weighs battery life, display, graphics, cooling, price; a food brand buyer weighs taste, ingredients, health claims; an IT services buyer weighs reliability, support quality, compliance, delivery track record). Use these criteria to shape the prompts — do not use generic criteria that ignore what this specific category cares about.

STEP 2 — Generate exactly {count} distinct prompts, distributed across:
- Core need / outcome the buyer is trying to solve
- Category-specific quality criteria (from Step 1)
- Comparisons between approaches or types of solution (not brand vs brand)
- A specific buyer persona or use-case (e.g. beginner, enterprise, daily use, students)
- Budget/price framing — cap this at roughly 20-25% of {count} (round down), using real numeric figures in rupees appropriate to the category (e.g. "under ₹40000" or "Rs.40000, never vague phrases like "affordable" or "budget-friendly")

RULES:
1. Never mention "{brand_name}", any of its aliases, or any of the known competitors ({competitors}) in any prompt — these must be neutral discovery questions a buyer would ask before knowing which brand to pick.
2. Every prompt must be grounded in India (Indian pricing in ₹, Indian buying context) unless the category is clearly global-only.
3. No two prompts should share the same sentence structure or opening phrase.
4. Write like a real person typing into a chat box, not a survey question.

Return exactly {count} prompts, one per line, no numbering, no extra commentary."""
SYSTEM_PROMPT = """You are simulating real buyers typing into AI assistants (ChatGPT, Perplexity, Gemini) while researching a market — BEFORE they know which brand they'll pick. Your job is to generate the prompts those buyers would actually type, for Generative Engine Optimization (GEO) tracking.

CONTEXT (internal use only — never surface in output, see Rule 1):
TARGET BRAND: {brand_name}
DOMAINS: {domains}
KNOWN COMPETITORS: {competitors}
ALIASES: {aliases}

═══ STEP 1 — Identify the category ═══
Determine the exact category this brand competes in, and the 4-5 criteria real buyers in THAT category weigh — not generic criteria. Examples: a laptop buyer weighs battery life, display, graphics, cooling, price; a food brand buyer weighs taste, ingredients, health claims, shelf life; an IT services buyer weighs reliability, support SLAs, compliance, delivery track record. Do this reasoning internally — do not output it.

═══ STEP 2 — Generate exactly {count} prompts ═══
Distribute across these buckets (do not label them in the output):
- Core need / outcome the buyer is trying to solve (solution-agnostic — they don't know what exists yet)
- Category-specific quality criteria (from Step 1)
- Comparisons between approaches or types of solution (never brand vs. brand)
- A specific buyer persona or use-case (e.g. beginner, enterprise, daily use, students, first-time buyer)
- Budget/price framing — cap at ~20-25% of {count} (round down). Use real Indian numeric figures (e.g. "under ₹40,000", "around ₹15,000-20,000") — never vague words like "affordable" or "budget-friendly"

Vary the buyer's phrasing pattern across prompts — rotate naturally between: direct questions ("what should I look for in..."), requests for suggestions ("suggest a few options for..."), comparisons ("what's the difference between... and..."), "best/top" framing, and first-person context-setting ("I'm a student looking for..."). No two prompts should open with the same word or clause structure.

Each prompt should read like a real, unpolished chat message — roughly 8-25 words, lowercase-casual is fine, no formal survey phrasing, no meta-commentary about being an AI or a search.

═══ RULES ═══
1. NEVER mention "{brand_name}", its aliases ({aliases}), or any known competitor ({competitors}) — directly, partially, or via an obvious distinguishing feature that would identify one of them. These are neutral discovery prompts asked before the buyer has a candidate in mind.
2. Ground every prompt in India (₹ pricing, Indian buying context, Indian availability) unless the category is clearly global-only (e.g. a global SaaS tool with no regional pricing) — if unsure, default to Indian context.
3. No repeated sentence openers or structures across the {count} prompts.
4. No quotation marks, numbering, bullets, or markdown in the output — plain prompts only.

═══ SELF-CHECK (do silently before returning) ═══
Before outputting, scan every prompt and discard/rewrite any that: mention the brand, an alias, or a competitor by name; use vague budget language instead of numbers; duplicate another prompt's opening structure; or sound like a survey question rather than something a person would type.

Return exactly {count} prompts, one per line, no numbering, no extra commentary, no preamble."""


def generate_prompt_variants(
    brand_name: str,
    count: int = DEFAULT_VARIANT_COUNT,
    competitors: list[str] | None = None,
    aliases: list[str] | None = None,
    domains: list[str] | None = None,
    seed_topic: str | None = None,
    model: str = MODEL,
) -> list[PromptVariant]:
    bounded_count = max(1, min(count, MAX_VARIANT_COUNT))
    competitors_str = ", ".join(competitors) if competitors else "None specified"
    aliases_str = ", ".join(aliases) if aliases else "None"
    domains_str = ", ".join(domains) if domains else "None specified"

    print(
        f"[OpenRouter API Call] Sending variant request to model: '{model}' for brand: '{brand_name}' (count={bounded_count})...",
        flush=True,
    )

    response = client.beta.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT.format(
                    brand_name=brand_name,
                    aliases=aliases_str,
                    competitors=competitors_str,
                    domains=domains_str,
                    count=bounded_count,
                ),
            },
            {
                "role": "user",
                "content": f"Generate {bounded_count} authentic discovery and evaluation search prompts that real potential customers or decision-makers would search in the domain of {brand_name}.",
            },
        ],
        response_format=VariantGenerationResponse,
    )

    parsed = response.choices[0].message.parsed
    if parsed and parsed.variants:
        return parsed.variants[:bounded_count]
    return []
