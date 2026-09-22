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
Your job is to generate realistic, conversational search prompts that an everyday consumer would type into an AI assistant (such as ChatGPT, Perplexity, or Gemini) or search engine when looking for product recommendations, evaluations, or buying advice.

CONTEXT:
- Target Brand: {brand_name}
- Brand Domains: {domains}
- Known Competitors: {competitors}
- Aliases: {aliases}

INSTRUCTIONS:
1. DEDUCE PRODUCT LINES & USE CASES:
   Analyze the Target Brand and its competitors to understand what products it actually makes and what real shoppers buy in that space (e.g. if Lenovo: gaming laptops with good cooling/FPS, durable coding/business laptops, college student laptops with long battery life, 2-in-1 touchscreens, all-in-one desktop PCs).
   Prompts must focus on these authentic use cases and consumer needs.

2. REALISTIC HUMAN PHRASING (NO CLICHÉS, NO TEXTBOOK QUESTIONS):
   - Real humans ask direct, natural questions like:
     "best gaming laptop with good battery life"
     "best laptop for coding and multitasking under 70000"
     "which laptops have the best keyboard and durability for daily office work"
     "what are the best laptops for video editing and graphic design"
     "lightweight laptop with long battery backup for college students under 50k"
   - DO NOT use cliché idioms like "won't break the bank", "on a dime", or "friendly on the wallet".
   - DO NOT use vague placeholders like "under a certain budget" or "at an affordable price point". If mentioning budget, ALWAYS use real numerical price points appropriate for the product (e.g. "under 50,000", "under 80,000", "under 1 lakh", "under 3000").
   - DO NOT ask overly theoretical or questionnaire-style questions like "What features should I look for in a gaming laptop?" or "How do the battery lives of different laptops compare for heavy usage?". Real shoppers ask for direct recommendations and comparisons.

3. CARDINAL RULE — ZERO TARGET BRAND MENTION:
   NEVER mention the Target Brand name ("{brand_name}") or any of its aliases in the prompts. The purpose of GEO tracking is to discover whether AI engines organically cite or recommend "{brand_name}" when answering unbiased consumer queries. Mentioning the brand directly ruins this tracking.

4. EXAMPLES OF POOR PROMPTS TO AVOID:
   - "Why is [Target Brand] better than other options?" (Directly names target brand - strictly forbidden)
   - "Good all-in-one computers for home that fit under a certain budget" (Unnatural placeholder - use real number like "under 60,000" or omit budget)
   - "What are the best laptops for graphic design that won't break the bank" (Cliché idiom - say "best laptops for graphic design" or "best laptops for graphic design under 70000")
   - "How do the battery lives of different laptops compare for heavy usage?" (Formal textbook survey question - say "laptops with best battery life for heavy work and coding")

5. DIVERSITY:
   Ensure the {count} prompts cover distinct, realistic angles across the brand's product ecosystem (e.g. high-performance/gaming, portability/battery life, office/coding durability, creative/editing work, budget-conscious tiers with concrete price limits).

Generate exactly {count} distinct prompt variants that a real human would ask."""


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
