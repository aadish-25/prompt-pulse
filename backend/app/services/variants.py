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
Your job is to generate realistic, conversational search prompts that an everyday consumer would type into an AI assistant (such as ChatGPT, Perplexity, or Gemini) when looking for product recommendations, evaluations, or buying advice.

CONTEXT:
- Target Brand: {brand_name}
- Brand Domains: {domains}
- Known Competitors: {competitors}
- Aliases: {aliases}

INSTRUCTIONS:
1. Dynamically analyze the Target Brand, its domains, and its competitor set to deduce its product category, market tier, and customer needs (e.g. footwear & sportswear if Adidas; consumer electronics/audio if boAt; dairy & FMCG if Amul; automotive if Toyota; skincare if CeraVe).
2. ACT AS A REAL HUMAN SHOPPER: Craft natural, conversational questions with genuine consumer intent (seeking brand recommendations, comparing product attributes, evaluating durability/value, asking for the best option for a specific budget or scenario).
3. CARDINAL RULE — ZERO TARGET BRAND MENTION:
   NEVER mention the Target Brand name ("{brand_name}") or any of its aliases in the prompts. The purpose of GEO tracking is to discover whether AI engines organically cite or recommend "{brand_name}" in response to unbiased consumer queries. Mentioning the brand directly ruins this tracking.

FIVE EXAMPLES OF WHAT PROMPTS SHOULD NOT BE (AND WHY):
- BAD EXAMPLE 1 (Direct Brand Mention / Biased Leading Question):
  "Why is [Target Brand] better than other options for daily running?"
  Why it fails: It directly names the target brand. Prompts must be unbiased discovery questions so the AI engine organically chooses which brands to recommend.
- BAD EXAMPLE 2 (Academic Encyclopedia / History / Manufacturing Trivia):
  "What is the thermodynamic process used to vulcanize rubber in shoe soles?" or "How was this commodity historically traded?"
  Why it fails: Real shoppers do not ask textbook theory questions when making buying decisions. These yield history or science lessons, not commercial brand recommendations.
- BAD EXAMPLE 3 (Robotic SEO Keyword-Stuffing / Affiliate Headline):
  "best budget wireless earbuds under 2000 india top 10 specs battery review 2026"
  Why it fails: Real humans typing to AI assistants ask conversational, coherent questions, not robotic keyword strings or affiliate blog post titles.
- BAD EXAMPLE 4 (Overly Vague / Zero-Context Keyword):
  "shoes" or "best laptops" or "good butter"
  Why it fails: Lacks the context, criteria, or constraints needed for an AI engine to provide a nuanced, comparative brand recommendation.
- BAD EXAMPLE 5 (Absurd / Non-Commercial Hypothetical):
  "Can I wear marathon running sneakers while deep sea scuba diving?"
  Why it fails: Real shoppers never ask absurd edge cases when purchasing products.

DIVERSE HUMAN INTENT ANGLES (Ensure wide variety across the {count} variants):
- Practical Use-Case & Scenario Fit (e.g. best for beginners, commuters, intense daily use, specific environmental conditions)
- Quality, Durability & Build Standards (e.g. materials, longevity, reliability, craftsmanship)
- Value for Money & Price-to-Performance (e.g. best affordable choices, or whether premium tiers justify the extra cost)
- Feature & Technology Trade-offs (e.g. comparing product attributes or formats within the deduced category)
- Reputation & Consumer Trust (e.g. which brands are most reliable or best reviewed by long-term users)

Generate exactly {count} distinct, creative prompt variants that a real human would ask. Every single variant must explore a different angle or consumer need."""


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
