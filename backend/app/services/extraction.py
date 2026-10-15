import re
import difflib
from typing import Literal
from pydantic import BaseModel
from app.config import MODEL, resolve_llm
from app.services.structured_output import structured_completion
from app.logger import logger, log_span


class ExtractedBrandMention(BaseModel):
    sentence: str
    matched_as: str


class ExtractionResult(BaseModel):
    other_brands: list[str]
    target_sentiment: Literal["positive", "neutral", "negative", "not_mentioned"]
    target_remark: str


EXTRACTION_SYSTEM_PROMPT = (
    "Analyze this product answer for brand {target_brand}.\n"
    "1. List all OTHER competitor brands mentioned (exclude {target_brand} and typos of it).\n"
    "2. Judge sentiment toward {target_brand}: positive, neutral, negative, or not_mentioned.\n"
    "3. One concise sentence remark explaining the judgment."
)


def find_target_mentions(
    answer: str, brand_name: str, aliases: list[str]
) -> list[ExtractedBrandMention]:
    results: list[ExtractedBrandMention] = []
    names_to_check = [brand_name] + (aliases or [])

    for line in answer.splitlines():
        clean_line = line.strip()
        if not clean_line:
            continue
        matched = False
        for name in names_to_check:
            if re.search(rf"\b{re.escape(name)}\b", clean_line, flags=re.IGNORECASE):
                results.append(ExtractedBrandMention(sentence=clean_line, matched_as=name))
                matched = True
                break

        if not matched and len(brand_name) >= 4:
            for token in re.findall(r"\b[A-Za-z0-9\-_]{4,}\b", clean_line):
                if difflib.SequenceMatcher(None, token.lower(), brand_name.lower()).ratio() >= 0.82:
                    results.append(ExtractedBrandMention(sentence=clean_line, matched_as=token))
                    break

    return results


def analyze_answer(
    answer: str,
    target_brand: str,
    model: str | None = None,
    user_keys: dict[str, str] | None = None,
) -> ExtractionResult:
    with log_span("analyze_answer", brand=target_brand, model=model or MODEL):
        raw_model = model or MODEL
        client, clean_model = resolve_llm(raw_model, user_keys=user_keys)

        result = structured_completion(
            client=client,
            model=clean_model,
            messages=[
                {
                    "role": "system",
                    "content": EXTRACTION_SYSTEM_PROMPT.format(target_brand=target_brand),
                },
                {"role": "user", "content": answer},
            ],
            response_model=ExtractionResult,
            max_tokens=600,
            raw_model=raw_model,
        )

        # Safety net: strip target brand and close typos from competitor list
        result.other_brands = [
            b for b in result.other_brands
            if b.lower() != target_brand.lower()
            and (len(target_brand) < 4 or difflib.SequenceMatcher(None, b.lower(), target_brand.lower()).ratio() < 0.82)
        ]

        logger.info(
            f"[EXTRACTION] Brand: {target_brand} | Sentiment: {result.target_sentiment} | "
            f"Competitors: {result.other_brands}"
        )
        return result
