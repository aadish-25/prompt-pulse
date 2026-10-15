from enum import Enum
from pydantic import BaseModel, Field
from app.config import (
    MODEL,
    DEFAULT_VARIANT_COUNT,
    MAX_VARIANT_COUNT,
    resolve_llm,
)
from app.services.structured_output import structured_completion
from app.logger import logger, log_span


class IntentCategory(str, Enum):
    CORE_NEED = "core_need"
    CATEGORY_CRITERIA = "criteria"
    COMPETITOR_CONQUEST = "competitor"
    PERSONA_USECASE = "persona"
    TRANSACTION_BUDGET = "transaction"


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
Every single generated prompt MUST be strictly relevant to {brand_name}'s actual product domain.

INTENT BUCKETS TO DISTRIBUTE ACROSS (balanced distribution):
1. 'core_need': Category problem solving or jobs-to-be-done without naming any brand.
2. 'criteria': Evaluation factors specific to this category.
3. 'competitor': Seeking alternatives to or comparing established incumbents from {competitors}.
4. 'persona': Specific buyer profiles or use cases.
5. 'transaction': Realistic Indian budget limits or purchasing decisions.

PROMPT STYLE & GROUNDING:
- Length: 5 to 18 words. Natural, punchy search phrasing.
- Phrasing: Mix of lowercase search fragments, direct questions, and phrases with 'according to reddit', 'with pros and cons', or 'user reviews'.
- Varied structures: Do NOT start every prompt with "Best...", "Which...", or "What is...".
- Current context: Year is 2026.

HARD RULES:
1. NEVER mention the target brand "{brand_name}", its aliases ({aliases}), or its official domains ({domains}) in ANY prompt.
2. You MAY mention known competitors ({competitors}) in the 'competitor' bucket.
3. Every prompt MUST strictly fit {brand_name}'s actual category.
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
    user_keys: dict[str, str] | None = None,
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

    with log_span("generate_prompt_variants", brand=brand_name, count=bounded_count, model=model):
        client, active_model = resolve_llm(model, user_keys=user_keys)
        logger.info(
            f"[VARIANTS] Requesting {bounded_count} variants -> Model: '{active_model}' "
            f"Brand: '{brand_name}' Topic: '{seed_topic_str}'"
        )

        result = structured_completion(
            client=client,
            model=active_model,
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
                {"role": "user", "content": user_content},
            ],
            response_model=VariantGenerationResponse,
            max_tokens=2000,
            raw_model=model,
        )

        variants = result.variants[:bounded_count] if result and result.variants else []
        logger.info(f"[VARIANTS] Successfully generated {len(variants)} prompt variants for {brand_name}")
        return variants
