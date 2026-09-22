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
Your job is to generate realistic, natural search prompts that everyday buyers or decision-makers ask AI assistants (like ChatGPT, Perplexity, Gemini) or search engines when discovering, comparing, and choosing solutions in the space of the target brand.

CONTEXT:
- Target Brand: {brand_name}
- Brand Domains: {domains}
- Known Competitors: {competitors}
- Aliases: {aliases}

INSTRUCTIONS:
1. INFER THE NATURE OF THE OFFERING & TARGET AUDIENCE:
   Dynamically analyze {brand_name}, its domain, and competitors to understand whether it provides:
   - Physical Consumer Goods (e.g. food, dairy, beverages, apparel, beauty, electronics, automotive)
   - B2B / Enterprise Services (e.g. IT services, software development, consulting, cloud migration)
   - Digital Products / SaaS (e.g. productivity tools, financial platforms)
   - Local or Specialized Services
   Ground all search prompts in the real-world problems and criteria that buyers in this exact industry care about.

2. DIVERSE HUMAN BUYING INTENTS (CROSS-INDUSTRY):
   Distribute the {count} prompts across authentic buyer decision stages:
   - Core Outcome / Primary Need: What main problem or task is the user seeking to achieve?
   - Quality, Standards & Ingredients / Methodology: How do buyers evaluate excellence here? (e.g. clean ingredients in food, expert engineering in tech, compliance/track-record in IT services, skin-friendliness in cosmetics)
   - Comparison & Alternatives: Comparing approaches, standards, or trade-offs (e.g. approach A vs B, or which type of solution is better for a specific goal)
   - Specific Scenario / Persona Fit: Tailored to a particular persona or context (e.g. beginners, enterprise scale, families, students, heavy workloads, daily use)
   - Value & Budget (MAX 2 OR 3 PROMPTS): Realistic pricing or cost-effectiveness evaluation.

3. PRICE VARIABILITY RULE:
   - AT MOST 2 OR 3 out of {count} prompts should mention a specific budget, price ceiling, or cost question.
   - The remaining 7 to 8 prompts MUST focus on outcomes, features, quality, or comparisons WITHOUT mentioning price.
   - When price is mentioned, use realistic, numerical market figures appropriate to the sector (e.g. under 50000, under 1.5 lakh, under 800, under $1000). Never use vague clichés like "won't break the bank" or "under a certain budget".

4. MULTI-DOMAIN EXAMPLES OF NATURAL HUMAN QUERIES:
   Notice how natural buyers search across completely different sectors:
   - Food / FMCG: "which brand of peanut butter has no hydrogenated oils or added sugar"
   - IT / Enterprise Services: "best enterprise cloud migration partners with banking compliance experience"
   - Consumer Electronics: "which laptops have the best cooling and battery for video editing"
   - Beauty / Skincare: "gentle foaming cleanser for sensitive skin that doesn't cause breakouts"
   - Footwear / Sports: "most comfortable road running shoes for daily marathon training with high arches"
   - Tech (Budget specific): "best camera phone under 35000 for low light video"

5. CARDINAL RULES:
   - ZERO TARGET BRAND MENTION: NEVER mention "{brand_name}" or its aliases in any prompt. Prompts must be unbiased discovery questions.
   - NO FORMULAIC DUPLICATION: Do not reuse the same sentence structure or price across multiple prompts.
   - NO TEXTBOOK SURVEY QUESTIONS: Write like a real human asking an AI assistant or search bar.

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

    print(f"[OpenRouter API Call] Sending variant request to model: '{model}' for brand: '{brand_name}' (count={bounded_count})...", flush=True)

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
