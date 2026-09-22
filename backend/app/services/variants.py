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


SYSTEM_PROMPT = """You are an expert at simulating authentic everyday human search queries for Generative Engine Optimization (GEO).
Your job is to generate realistic, conversational search prompts that everyday consumers ask AI assistants (like ChatGPT, Perplexity, Gemini) or search engines when researching and purchasing products in the space of the target brand.

CONTEXT:
- Target Brand: {brand_name}
- Brand Domains: {domains}
- Known Competitors: {competitors}
- Aliases: {aliases}

INSTRUCTIONS:
1. DEDUCE CATEGORY & CONSUMER NEEDS:
   Dynamically analyze {brand_name}, its domains, and competitors to deduce its exact product categories, market tier, and what real buyers care about (e.g. build quality, performance, battery, durability, comfort, design, value).
   All prompts must reflect authentic purchase journeys in this brand's market.

2. PRICE VARIABILITY (CRITICAL RULE — ONLY 2 TO 3 PROMPTS WITH PRICE):
   - At most 2 or 3 out of {count} prompts should include an explicit price ceiling or budget limit.
   - The remaining 7 or 8 prompts MUST focus purely on use cases, quality, performance, durability, or comparisons WITHOUT any price mentioned.
   - For the 2-3 prompts that DO include a price: use realistic, numerical market figures appropriate to the category (e.g. "under 50000", "under 1.5 lakh", "under 3000"). Never use placeholder phrases like "under a certain budget" or clichés like "won't break the bank".

3. REALISTIC HUMAN STYLES ACROSS DIVERSE INDUSTRIES (EXAMPLES OF AUTHENTIC PHRASING):
   Real consumers ask natural questions and focused search phrases. Notice how these examples span completely different domains:
   - Performance / Use-case (No price): "Which wireless earbuds have the best mic quality for outdoor zoom calls?"
   - Durability / Build (No price): "most durable running shoes for daily marathon training with high arch support"
   - Comparison / Trade-off (No price): "Is an OLED screen worth it for office work or does IPS cause less eye strain?"
   - Pain-point Solution (No price): "laptops with best cooling that don't overheat or throttle during long renders"
   - Budget-conscious (Specific numerical price): "best camera phone under 35000 for low light video"

4. WHAT TO AVOID:
   - NEVER mention the target brand name ("{brand_name}") or any alias in the query.
   - DO NOT make all prompts follow the same template or price bracket. Vary the structure (some direct questions, some search phrases).
   - DO NOT use cliché marketing idioms ("won't break the bank", "on a dime", "budget-friendly picks").
   - DO NOT write textbook or academic survey questions ("How do the technical specifications of..."). Real shoppers ask practical buying questions.

5. DIVERSITY:
   Distribute the {count} prompts across different personas and use cases (e.g. professionals, students, enthusiasts, beginners, heavy users, commuters).

Generate exactly {count} distinct, authentic prompt variants."""


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
                "content": f"Generate {bounded_count} realistic, human consumer search prompts for shopping in the product space of {brand_name}.",
            },
        ],
        response_format=VariantGenerationResponse,
    )

    parsed = response.choices[0].message.parsed
    if parsed and parsed.variants:
        return parsed.variants[:bounded_count]
    return []
