import os
from typing import Literal
from pydantic import BaseModel
from openai import OpenAI
from app.config import MODEL

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)


class BrandMention(BaseModel):
    sentence: str
    matched_as: str


class ExtractionResult(BaseModel):
    other_brands: list[str]
    target_sentiment: Literal["positive", "neutral", "negative", "not_mentioned"]
    target_remark: str  # short reason/evidence for the sentiment, e.g. "listed last but praised as effective"


EXTRACTION_SYSTEM_PROMPT = (
    "You analyze an AI-generated answer about products for one specific "
    "brand: {target_brand}.\n\n"
    "1. List every OTHER distinct brand name mentioned (exclude {target_brand} itself).\n"
    "2. Judge the sentiment specifically toward {target_brand}: "
    "'positive', 'neutral', 'negative', or 'not_mentioned' if it doesn't appear at all.\n"
    "3. Give a short one-sentence remark explaining that sentiment judgment, "
    "quoting or paraphrasing the relevant part of the answer. If not mentioned, "
    "say so briefly."
)


def find_target_mentions(
    answer: str, brand_name: str, aliases: list[str]
) -> list[BrandMention]:
    results: list[BrandMention] = []
    names_to_check = [brand_name] + aliases

    for line in answer.splitlines():
        if not line.strip():
            continue
        for name in names_to_check:
            if name.lower() in line.lower():
                results.append(BrandMention(sentence=line, matched_as=name))
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

    # safety net: strip target brand from its own competitor list if the model slips up
    result.other_brands = [
        b for b in result.other_brands if b.lower() != target_brand.lower()
    ]
    return result
