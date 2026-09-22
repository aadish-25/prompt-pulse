import os
import re
import difflib
from typing import Literal
from pydantic import BaseModel
from openai import OpenAI
from app.config import MODEL

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)


class ExtractedBrandMention(BaseModel):
    """A single mention of the target brand found by text matching. Named
    'Extracted' to distinguish it from the SQLAlchemy models.BrandMention ORM class."""
    sentence: str
    matched_as: str


class ExtractionResult(BaseModel):
    other_brands: list[str]
    target_sentiment: Literal["positive", "neutral", "negative", "not_mentioned"]
    target_remark: str  # short reason/evidence for the sentiment, e.g. "listed last but praised as effective"


EXTRACTION_SYSTEM_PROMPT = (
    "You analyze an AI-generated answer about products for one specific "
    "brand: {target_brand}.\n\n"
    "1. List every OTHER distinct brand name mentioned (exclude {target_brand} and common misspellings of it).\n"
    "2. Judge the sentiment specifically toward {target_brand}: "
    "'positive', 'neutral', 'negative', or 'not_mentioned' if it doesn't appear at all.\n"
    "3. Give a short one-sentence remark explaining that sentiment judgment, "
    "quoting or paraphrasing the relevant part of the answer. If not mentioned, "
    "say so briefly."
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
            # word-boundary regex prevents false positives like matching
            # "boat" inside "sailboat" or "bata" inside "debate"
            if re.search(rf"\b{re.escape(name)}\b", clean_line, flags=re.IGNORECASE):
                results.append(ExtractedBrandMention(sentence=clean_line, matched_as=name))
                matched = True
                break

        # If no exact match, check for single-character typos (e.g. 'Lenevo' vs 'Lenovo')
        if not matched and len(brand_name) >= 4:
            for token in re.findall(r"\b[A-Za-z0-9\-_]{4,}\b", clean_line):
                if difflib.SequenceMatcher(None, token.lower(), brand_name.lower()).ratio() >= 0.82:
                    results.append(ExtractedBrandMention(sentence=clean_line, matched_as=token))
                    break

    return results


def analyze_answer(answer: str, target_brand: str) -> ExtractionResult:
    """
    One combined LLM call: lists competitor brands and judges sentiment
    toward the target brand, with a short remark as evidence.
    """
    response = client.beta.chat.completions.parse(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": EXTRACTION_SYSTEM_PROMPT.format(target_brand=target_brand),
            },
            {"role": "user", "content": answer},
        ],
        response_format=ExtractionResult,
    )

    result = response.choices[0].message.parsed
    if result is None:
        return ExtractionResult(
            other_brands=[], target_sentiment="not_mentioned", target_remark=""
        )

    # safety net: strip target brand and close typos from competitor list
    result.other_brands = [
        b for b in result.other_brands
        if b.lower() != target_brand.lower()
        and (len(target_brand) < 4 or difflib.SequenceMatcher(None, b.lower(), target_brand.lower()).ratio() < 0.82)
    ]
    return result
