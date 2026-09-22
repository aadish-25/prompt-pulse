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
Your goal is to generate natural, realistic search queries and questions that real people ask AI engines (ChatGPT, Perplexity, Gemini).

CONTEXT:
- Target Brand to optimize for: {brand_name}
- Aliases: {aliases}
- Competitors: {competitors}
- Seed Topic: {seed_topic}

CRITICAL RULES:
1. NEVER mention the target brand name ("{brand_name}") or any of its aliases in the generated prompts. Mentioning the target brand directly produces biased answers and ruins organic tracking.
2. Formulate prompts around consumer needs, purchase criteria, and use cases where {brand_name} is a competitive candidate, giving it an authentic opportunity to be recommended or cited.
3. Span multiple realistic search intents:
   - Everyday use / functional suitability
   - Value for money / budget tiers
   - Category comparison (e.g. salted vs unsalted, neckband vs TWS, etc.)
   - Quality, popularity, and consumer trust
4. Keep the wording conversational, natural, and humanized — the way real consumers actually type or speak questions.
5. Generate exactly {count} distinct prompt variants.
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
