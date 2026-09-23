import os
from enum import Enum
from pydantic import BaseModel, Field
from openai import OpenAI
from app.config import MODEL, DEFAULT_VARIANT_COUNT, MAX_VARIANT_COUNT


def get_client():
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ.get("OPENROUTER_API_KEY", ""),
    )


class IntentCategory(str, Enum):
    CORE_NEED = "core_need"             # Problem / outcome-focused
    CATEGORY_CRITERIA = "criteria"      # Evaluation factors (speed, security, specs)
    COMPETITOR_CONQUEST = "competitor"  # Alternatives to known competitors
    PERSONA_USECASE = "persona"         # Beginner, enterprise, freelancer, etc.
    TRANSACTION_BUDGET = "transaction"  # Pricing, plans, ₹ budget thresholds


class PromptVariant(BaseModel):
    text: str = Field(
        description="Punchy, realistic query (5-18 words) as typed into ChatGPT/Perplexity/Gemini. Natural phrasing, no quotes."
    )
    intent_category: IntentCategory = Field(
        description="The primary intent bucket this prompt belongs to."
    )
    rationale: str = Field(
        description="1-sentence reason why a real buyer would ask this during evaluation."
    )


class VariantGenerationResponse(BaseModel):
    variants: list[PromptVariant]


SYSTEM_PROMPT = """You simulate real buyers and decision-makers typing into AI assistants (ChatGPT, Perplexity, Gemini) while researching a product or service in India — BEFORE deciding which brand to pick. Generate the search prompts those buyers would actually type for Generative Engine Optimization (GEO) tracking.

CONTEXT:
TARGET BRAND: {brand_name}
CATEGORY / NICHE: {seed_topic}
DOMAINS: {domains}
KNOWN COMPETITORS: {competitors}
BRAND ALIASES: {aliases}
TARGET GEOGRAPHY: India (pricing in ₹, Indian workflow and market context)
CURRENT YEAR: 2026

PRIMARY OBJECTIVE:
Deduce the EXACT product category of {brand_name} based on its name, domains ({domains}), and known competitors ({competitors}).
Every single generated prompt MUST be strictly relevant to {brand_name}'s actual product domain (e.g. if {brand_name} makes laptops/PCs, every prompt must be about laptops, PCs, hardware, performance, cooling, or computing. NEVER generate prompts for unrelated industries like accounting, food, or generic SaaS).

INTENT BUCKETS TO DISTRIBUTE ACROSS (balanced distribution):
1. 'core_need': Category problem solving or jobs-to-be-done without naming any brand (e.g. for laptops: "best laptop for programming and machine learning", "lightweight laptop with long battery life").
2. 'criteria': Evaluation factors specific to this category (e.g. specs, display quality, thermal management, build durability, after-sales service in India).
3. 'competitor': Seeking alternatives to or comparing established incumbents from {competitors} (e.g. "top alternatives to [Competitor]", "[CompetitorA] vs [CompetitorB] for college students").
4. 'persona': Specific buyer profiles or use cases (e.g. for coding, video editing, business travel, college students, CAD work).
5. 'transaction': Realistic Indian budget limits or purchasing decisions (e.g. "under ₹50,000", "best value under ₹80,000", "student discounts in India").

PROMPT STYLE & GROUNDING:
- Length: 5 to 18 words. Natural, punchy search phrasing as real users type into ChatGPT, Perplexity, or Gemini.
- Phrasing: Mix of lowercase search fragments, direct questions, and phrases with 'according to reddit', 'with pros and cons', or 'user reviews'.
- Varied structures: Do NOT start every prompt with "Best...", "Which...", or "What is...".
- Current context: Year is 2026. Do NOT mention outdated years like 2023 or 2024.

HARD RULES:
1. NEVER mention the target brand "{brand_name}", its aliases ({aliases}), or its official domains ({domains}) in ANY prompt. The target brand must earn the recommendation organically.
2. You MAY mention known competitors ({competitors}) in the 'competitor' bucket to test displacement visibility.
3. Every prompt MUST strictly fit {brand_name}'s actual category. Do NOT hallucinate unrelated software, accounting, or services.
4. Distribute roughly evenly across the 5 intent buckets.

Generate exactly {count} distinct prompt variants conforming to the JSON schema."""


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
    seed_topic_str = seed_topic.strip() if seed_topic else f"Deduced from {brand_name} and competitors ({competitors_str})"

    user_content = (
        f"Generate {bounded_count} authentic discovery and evaluation search prompts for {brand_name} in the category '{seed_topic.strip()}'."
        if seed_topic and seed_topic.strip()
        else f"Generate {bounded_count} authentic discovery and evaluation search prompts for the product category of {brand_name} (Competitors: {competitors_str})."
    )

    print(
        f"[OpenRouter API Call] Sending variant request to model: '{model}' for brand: '{brand_name}' (topic='{seed_topic_str}', count={bounded_count})...",
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
                    seed_topic=seed_topic_str,
                    aliases=aliases_str,
                    competitors=competitors_str,
                    domains=domains_str,
                    count=bounded_count,
                ),
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
        response_format=VariantGenerationResponse,
    )

    parsed = response.choices[0].message.parsed
    if parsed and parsed.variants:
        return parsed.variants[:bounded_count]
    return []
