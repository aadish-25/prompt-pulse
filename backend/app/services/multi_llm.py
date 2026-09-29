"""
PromptPulse Multi-LLM Side-by-Side Comparison Engine.

Evaluates a single target prompt concurrently across 4 distinct AI reasoning engines:
- OpenAI (GPT-4o Mini / GPT-4o)
- Google Gemini (Gemini 2.5 Flash)
- Anthropic Claude (Claude 3.5 Haiku)
- Perplexity / Sonar (Deep Web Search Reasoning)

Extracts brand mention presence, rank position, sentiment, citations, and latency per engine.
"""
import time
import concurrent.futures
from pydantic import BaseModel
from app.config import resolve_llm
from app.logger import logger, log_span


class ModelEvaluationResult(BaseModel):
    model_id: str
    display_name: str
    provider: str
    mentioned: bool
    rank: int | None
    sentiment: str  # "positive" | "neutral" | "negative" | "not_mentioned"
    summary: str
    full_response: str
    citations: list[str]
    latency_ms: float
    error: str | None = None


class MultiLLMComparisonReport(BaseModel):
    prompt_id: int | None
    prompt_text: str
    brand_name: str
    models_evaluated: int
    models_mentioning_brand: int
    visibility_score_pct: float
    evaluations: list[ModelEvaluationResult]


COMPARISON_PRESETS = [
    {
        "model_id": "OR: openai/gpt-4o-mini",
        "display_name": "OpenAI GPT-4o Mini",
        "provider": "OpenAI",
    },
    {
        "model_id": "OR: google/gemini-2.5-flash",
        "display_name": "Google Gemini 2.5 Flash",
        "provider": "Google",
    },
    {
        "model_id": "OR: meta-llama/llama-3.3-70b-instruct",
        "display_name": "Llama 3.3 70B Instruct",
        "provider": "Meta / Open-Weights",
    },
    {
        "model_id": "GROQ: llama-3.3-70b-versatile",
        "display_name": "Groq LPU (Ultra-Low Latency)",
        "provider": "Groq",
    },
]


def _evaluate_single_model(
    preset: dict,
    prompt_text: str,
    brand_name: str,
    aliases: list[str],
    user_keys: dict[str, str] | None = None,
    timeout_secs: float = 25.0,
) -> ModelEvaluationResult:
    start_time = time.perf_counter()
    model_id = preset["model_id"]
    display_name = preset["display_name"]
    provider = preset["provider"]

    try:
        client, clean_model = resolve_llm(model_id, user_keys=user_keys)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful, objective research assistant. Answer the user prompt directly, "
                    "recommending the most reputable, high-performing tools or solutions. "
                    "Include relevant links, product names, and brief pros/cons where appropriate."
                ),
            },
            {"role": "user", "content": prompt_text},
        ]

        response = client.chat.completions.create(
            model=clean_model,
            messages=messages,
            temperature=0.3,
            max_tokens=600,
            timeout=timeout_secs,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        content = response.choices[0].message.content or ""

        # Analyze brand presence
        brand_tokens = [brand_name.lower()] + [a.lower() for a in (aliases or []) if a]
        content_lower = content.lower()
        mentioned = any(b in content_lower for b in brand_tokens)

        # Detect rank position (1st, 2nd, etc. based on line or paragraph order)
        rank = None
        if mentioned:
            lines = [l.strip() for l in content.split("\n") if l.strip()]
            for idx, line in enumerate(lines[:10], start=1):
                if any(b in line.lower() for b in brand_tokens):
                    rank = idx
                    break

        # Sentiment heuristic
        sentiment = "not_mentioned"
        if mentioned:
            positive_words = ["best", "leading", "top", "great", "excellent", "recommended", "popular", "powerful"]
            negative_words = ["drawback", "expensive", "limited", "lacks", "slow", "buggy", "issue", "avoid"]
            pos_matches = sum(1 for w in positive_words if w in content_lower)
            neg_matches = sum(1 for w in negative_words if w in content_lower)
            if pos_matches >= neg_matches and pos_matches > 0:
                sentiment = "positive"
            elif neg_matches > pos_matches:
                sentiment = "negative"
            else:
                sentiment = "neutral"

        # Citations / URLs detected
        import re
        citations = re.findall(r"https?://[^\s)\]]+", content)[:5]

        # Concise summary (first 240 chars)
        summary = content[:240].strip() + ("..." if len(content) > 240 else "")

        return ModelEvaluationResult(
            model_id=clean_model,
            display_name=display_name,
            provider=provider,
            mentioned=mentioned,
            rank=rank,
            sentiment=sentiment,
            summary=summary,
            full_response=content,
            citations=citations,
            latency_ms=round(latency_ms, 1),
            error=None,
        )

    except Exception as exc:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        logger.warning(f"[MULTI-LLM] Evaluation failed for {display_name}: {exc}")
        return ModelEvaluationResult(
            model_id=model_id,
            display_name=display_name,
            provider=provider,
            mentioned=False,
            rank=None,
            sentiment="not_mentioned",
            summary="",
            full_response="",
            citations=[],
            latency_ms=round(latency_ms, 1),
            error=str(exc),
        )


def compare_prompt_across_models(
    prompt_text: str,
    brand_name: str,
    aliases: list[str] | None = None,
    prompt_id: int | None = None,
    user_keys: dict[str, str] | None = None,
) -> MultiLLMComparisonReport:
    """Runs the prompt simultaneously across the comparison models."""
    with log_span("multi_llm_comparison", prompt=prompt_text[:40], brand=brand_name):
        evaluations: list[ModelEvaluationResult] = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_preset = {
                executor.submit(
                    _evaluate_single_model,
                    preset,
                    prompt_text,
                    brand_name,
                    aliases or [],
                    user_keys,
                ): preset
                for preset in COMPARISON_PRESETS
            }

            for future in concurrent.futures.as_completed(future_to_preset):
                try:
                    res = future.result()
                    evaluations.append(res)
                except Exception as exc:
                    preset = future_to_preset[future]
                    evaluations.append(
                        ModelEvaluationResult(
                            model_id=preset["model_id"],
                            display_name=preset["display_name"],
                            provider=preset["provider"],
                            mentioned=False,
                            rank=None,
                            sentiment="not_mentioned",
                            summary="",
                            full_response="",
                            citations=[],
                            latency_ms=0.0,
                            error=str(exc),
                        )
                    )

        # Sort evaluations according to original preset order
        order_map = {p["display_name"]: i for i, p in enumerate(COMPARISON_PRESETS)}
        evaluations.sort(key=lambda x: order_map.get(x.display_name, 99))

        models_count = len(evaluations)
        mention_count = sum(1 for e in evaluations if e.mentioned)
        visibility_score = round((mention_count / models_count * 100.0), 1) if models_count > 0 else 0.0

        return MultiLLMComparisonReport(
            prompt_id=prompt_id,
            prompt_text=prompt_text,
            brand_name=brand_name,
            models_evaluated=models_count,
            models_mentioning_brand=mention_count,
            visibility_score_pct=visibility_score,
            evaluations=evaluations,
        )
