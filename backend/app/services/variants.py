import os
from pydantic import BaseModel
from openai import OpenAI
from app.config import MODEL, DEFAULT_VARIANT_COUNT, MAX_VARIANT_COUNT

def get_client():
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ.get("OPENROUTER_API_KEY", ""),
    )


class PromptVariant(BaseModel):
    text: str
    intent_category: str
    rationale: str


class VariantGenerationResponse(BaseModel):
    variants: list[PromptVariant]


SYSTEM_PROMPT = """You simulate real buyers typing into AI assistants (ChatGPT, Perplexity, Gemini) while researching a market — BEFORE deciding which brand to pick. Generate the prompts those buyers would actually type for Generative Engine Optimization (GEO) tracking.

CONTEXT (internal only — never surface in output, see Rule 1):
TARGET BRAND: {brand_name}
DOMAINS: {domains}
KNOWN COMPETITORS: {competitors}
ALIASES: {aliases}

STEP 1: Category & Evaluation Criteria
Internally deduce the brand's exact market category and the 4-5 criteria real buyers evaluate (e.g. laptops: battery, display, thermals, performance; food: taste, pure ingredients, health claims; IT services: reliability, SLAs, compliance, delivery record). Do not output this reasoning.

STEP 2: Generate exactly {count} prompts
Distribute across these buckets:
- Core need / outcome (solution-agnostic)
- Category-specific quality criteria (from Step 1)
- Comparisons between approaches/types (never brand vs brand)
- Specific persona / use-case (e.g. beginner, enterprise, students, heavy use)
- Budget framing (cap at ~20-25% of {count}, round down). Use real Indian figures (e.g. "under ₹40,000", "around ₹15,000-20,000") — never vague terms like "affordable".
Rotate naturally between direct questions, recommendation requests, comparisons, and first-person context. No repeated openers or clause structures across prompts.
Keep each prompt 8-25 words, natural and unpolished, without formal survey phrasing.

RULES
1. NEVER mention "{brand_name}", aliases ({aliases}), or competitors ({competitors}) in any prompt.
2. Ground prompts in India (₹ pricing, Indian buying context) unless the category is global-only.
3. No repeated sentence openers or identical structures across prompts.

SELFCHECK
Silently discard any candidate mentioning brand/competitor names, using vague budget words, or repeating sentence patterns.

Generate exactly {count} distinct prompt variants conforming to the schema."""


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

    client = get_client()
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
