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


SYSTEM_PROMPT = """You are an expert in Generative Engine Optimization (GEO) and consumer search behavior.
Your goal is to generate natural, realistic search queries and purchase-decision questions that real consumers ask AI engines (ChatGPT, Perplexity, Gemini).

CONTEXT:
- Target Brand to optimize for: {brand_name}
- Aliases: {aliases}
- Known Competitors in this category: {competitors}
- Seed Category / Topic: {seed_topic}

CRITICAL RULES:
1. NEVER mention the target brand name ("{brand_name}") or any of its aliases in the generated prompts. Mentioning the target brand directly produces biased answers and ruins organic tracking.
2. Focus on HIGH-INTENT BRAND RECOMMENDATIONS & PURCHASE DECISIONS. Formulate queries where an AI engine is asked to recommend, compare, or rank specific commercially packaged brands or supermarket products (e.g. "Which butter brand is best for everyday cooking in India?", "What are the most affordable alternatives to premium ice cream brands?", "Which dairy brand is most trusted for milk and packaged paneer?").
3. STRICTLY AVOID generic cooking technique tutorials, raw ingredient explanations, or basic health benefit questions (e.g. NEVER generate "What are the benefits of using ghee?" or "What type of milk is best for homemade yogurt?"). Those produce cooking tips rather than brand recommendations.
4. Span multiple commercial purchase intents:
   - Supermarket buying decisions / top brand recommendations
   - Value for money / budget vs premium alternatives
   - Taste, consistency, and culinary performance comparisons across packaged brands
   - Consumer trust, purity, and certification ratings in supermarkets
5. Keep the language natural, human, conversational, and direct — the exact way a shopper speaks or types into an AI assistant.
6. Generate exactly {count} distinct prompt variants.
"""


def generate_prompt_variants(
    brand_name: str,
    seed_topic: str,
    count: int = DEFAULT_VARIANT_COUNT,
    competitors: list[str] | None = None,
    aliases: list[str] | None = None,
    model: str = MODEL,
) -> list[PromptVariant]:
    bounded_count = max(1, min(count, MAX_VARIANT_COUNT))
    competitors_str = ", ".join(competitors) if competitors else "None specified"
    aliases_str = ", ".join(aliases) if aliases else "None"

    response = client.beta.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT.format(
                    brand_name=brand_name,
                    aliases=aliases_str,
                    competitors=competitors_str,
                    seed_topic=seed_topic,
                    count=bounded_count,
                ),
            },
            {
                "role": "user",
                "content": f"Generate {bounded_count} humanized prompt variants for the topic: '{seed_topic}'.",
            },
        ],
        response_format=VariantGenerationResponse,
    )

    parsed = response.choices[0].message.parsed
    if parsed and parsed.variants:
        return parsed.variants[:bounded_count]
    return []
