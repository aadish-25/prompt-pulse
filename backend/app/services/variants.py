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


SYSTEM_PROMPT = """You simulate real buyers and decision-makers typing into AI assistants (ChatGPT, Perplexity, Gemini) while researching an Indian market — BEFORE deciding which brand to pick. Generate the search prompts those buyers would actually type for Generative Engine Optimization (GEO) tracking.

CONTEXT:
TARGET BRAND: {brand_name}
CATEGORY / SEED TOPIC: {seed_topic}
DOMAINS: {domains}
KNOWN COMPETITORS: {competitors}
BRAND ALIASES: {aliases}
TARGET GEOGRAPHY: India (pricing in ₹, Indian workflow and regulatory contexts)

INTENT BUCKETS TO DISTRIBUTE ACROSS (Generate balanced quantities):
1. 'core_need': Solution-agnostic problem solving (e.g. "how to automate GST invoicing for ecommerce").
2. 'criteria': Specific evaluation factors (e.g. "fastest delivery", "uptime SLA", "local customer support").
3. 'competitor': Seeking alternatives to established incumbents (e.g. "top alternatives to [Competitor]", "[Competitor] vs other options for small teams").
4. 'persona': Specific buyer profiles or constraints (e.g. "for seed-stage startups", "for non-technical founders", "for high-volume retail").
5. 'transaction': Realistic Indian budget limits or buying signals (e.g. "under ₹25,000", "free tier with API access", "monthly pricing in INR").

PROMPT STYLE & GROUNDING:
- Length: 5 to 18 words. Avoid wordy essay prompts or formal survey questions.
- Phrasing: Real search fragments (mix of lowercase queries, direct questions, and phrases with 'recommendations', 'with pros and cons', or 'according to reviews').
- Natural variation: Rotate structures. Do NOT start multiple prompts with "Best...", "Which...", or "What is...".

HARD RULES:
1. NEVER include the target brand "{brand_name}", its aliases ({aliases}), or its domains ({domains}) in ANY prompt. The target brand must EARN the mention organically.
2. You MAY and SHOULD mention known competitors ({competitors}) in 'competitor' bucket prompts to test displacement/conquesting visibility.
3. Ground in real Indian market context (₹ figures, GST/UPI, Indian scale) unless the topic is explicitly global-only.
4. Distribute roughly evenly across all 5 buckets.

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
    seed_topic_str = seed_topic.strip() if seed_topic else "Infer from brand context"

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
                "content": f"Generate {bounded_count} authentic discovery and evaluation search prompts for {brand_name} in the category: {seed_topic_str}.",
            },
        ],
        response_format=VariantGenerationResponse,
    )

    parsed = response.choices[0].message.parsed
    if parsed and parsed.variants:
        return parsed.variants[:bounded_count]
    return []
