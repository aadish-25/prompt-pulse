import json
import re
from typing import Type, TypeVar
from openai import OpenAI
from pydantic import BaseModel
from app.logger import logger

T = TypeVar("T", bound=BaseModel)

NATIVE_STRUCTURED_OUTPUT_PROVIDERS = {"OR", "OPENAI"}


def structured_completion(
    client: OpenAI,
    model: str,
    messages: list[dict],
    response_model: Type[T],
    max_tokens: int = 1500,
    raw_model: str = "",
) -> T:
    """
    Returns a parsed Pydantic model from an LLM call.
    Uses .beta.parse for OpenAI/OpenRouter, falls back to json_mode for Groq/DeepSeek/others.
    """
    prefix = raw_model.split(":")[0].strip().upper() if ":" in raw_model else "OR"

    if prefix in NATIVE_STRUCTURED_OUTPUT_PROVIDERS:
        try:
            response = client.beta.chat.completions.parse(
                model=model,
                messages=messages,
                response_format=response_model,
                max_tokens=max_tokens,
            )
            parsed = response.choices[0].message.parsed
            if parsed is not None:
                return parsed
        except (AttributeError, Exception) as e:
            logger.warning(f"Native .beta.parse failed ({type(e).__name__}: {e}), falling back to json_mode")

    # Fallback: json_mode with schema prompt
    schema_hint = f"\n\nRespond ONLY with valid JSON matching this schema:\n{json.dumps(response_model.model_json_schema(), indent=2)}"
    messages_with_hint = [m.copy() for m in messages]
    if messages_with_hint and messages_with_hint[-1]["role"] == "user":
        messages_with_hint[-1]["content"] = messages_with_hint[-1]["content"] + schema_hint
    else:
        messages_with_hint.append({"role": "user", "content": schema_hint})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages_with_hint,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content or "{}"
        return response_model.model_validate_json(content)
    except Exception as e:
        logger.warning(f"json_mode completion failed ({e}), attempting regex extraction")
        # Raw response fallback
        response = client.chat.completions.create(
            model=model,
            messages=messages_with_hint,
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content or "{}"
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return response_model.model_validate_json(match.group(0))
        raise ValueError(f"Could not extract JSON structured output from model response: {content[:150]}")
