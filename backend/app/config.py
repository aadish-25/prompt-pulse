import os
from dotenv import load_dotenv
from openai import OpenAI
from app.logger import logger

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ROUNDS = 1
MAX_SEARCH_STEPS = 5

# Server Provider API Keys (Fallbacks)
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
AGENTROUTER_API_KEY = os.environ.get("AGENTROUTER_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
CUSTOM_LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
CUSTOM_LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")
# Dedicated Demo / Free-Tier Keys (Optional Segregation)
DEMO_OPENROUTER_API_KEY = os.environ.get("DEMO_OPENROUTER_API_KEY", "")
DEMO_GROQ_API_KEY = os.environ.get("DEMO_GROQ_API_KEY", "")
DEMO_TAVILY_API_KEY = os.environ.get("DEMO_TAVILY_API_KEY", "")

# Base URLs
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
AGENTROUTER_BASE_URL = os.environ.get("AGENTROUTER_BASE_URL", "https://co.agentrouter.org/v1")
GROQ_BASE_URL = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# Curated Models with Provider Prefixes
SUPPORTED_MODELS = [
    # OpenRouter
    "OR: openai/gpt-4o-mini",
    "OR: google/gemini-2.5-flash",
    "OR: meta-llama/llama-3.3-70b-instruct",
    "OR: openai/gpt-4o",
    # Groq (ultra-fast inference, high RPM)
    "GROQ: llama-3.3-70b-versatile",
    "GROQ: llama-3.1-8b-instant",
    "GROQ: mixtral-8x7b-32768",
    # DeepSeek Direct
    "DS: deepseek-chat",
    "DS: deepseek-reasoner",
]

DEFAULT_MODEL = "OR: openai/gpt-4o-mini"
MODEL = DEFAULT_MODEL

# Provider Configuration mapping
PROVIDER_CONFIG = {
    "OR": {
        "name": "openrouter",
        "base_url": OPENROUTER_BASE_URL,
        "server_key": lambda: os.environ.get("OPENROUTER_API_KEY", OPENROUTER_API_KEY) or CUSTOM_LLM_API_KEY,
    },
    "GROQ": {
        "name": "groq",
        "base_url": GROQ_BASE_URL,
        "server_key": lambda: os.environ.get("GROQ_API_KEY", GROQ_API_KEY) or CUSTOM_LLM_API_KEY,
    },
    "AR": {
        "name": "agentrouter",
        "base_url": AGENTROUTER_BASE_URL,
        "server_key": lambda: os.environ.get("AGENTROUTER_API_KEY", AGENTROUTER_API_KEY) or CUSTOM_LLM_API_KEY,
    },
    "DS": {
        "name": "deepseek",
        "base_url": DEEPSEEK_BASE_URL,
        "server_key": lambda: os.environ.get("DEEPSEEK_API_KEY", DEEPSEEK_API_KEY) or CUSTOM_LLM_API_KEY,
    },
}


def mask_key(k: str) -> str:
    if not k:
        return "[empty]"
    if len(k) <= 8:
        return "***"
    return f"{k[:4]}...{k[-4:]}"


def resolve_llm(
    model_name: str | None = None,
    user_keys: dict[str, str] | None = None,
    is_demo: bool = False,
) -> tuple[OpenAI, str]:
    """
    Parses prefix from model_name and returns an initialized OpenAI client with
    the matching Base URL and API Key.
    Prioritizes user_keys (BYOK); falls back to dedicated demo keys (if demo user),
    or master server default keys.
    """
    raw = (model_name or MODEL or DEFAULT_MODEL).strip()
    user_keys = user_keys or {}

    if ":" in raw:
        prefix, clean_model = raw.split(":", 1)
        prefix = prefix.strip().upper()
        clean_model = clean_model.strip()

        cfg = PROVIDER_CONFIG.get(prefix)
        if cfg:
            provider_name = cfg["name"]
            # 1. User supplied BYOK key
            chosen_key = user_keys.get(provider_name) or user_keys.get(prefix.lower())
            is_byok = bool(chosen_key)

            if not chosen_key and is_demo:
                # 2. Check dedicated demo key segregation
                if prefix == "OR" and DEMO_OPENROUTER_API_KEY:
                    chosen_key = DEMO_OPENROUTER_API_KEY
                elif prefix == "GROQ" and DEMO_GROQ_API_KEY:
                    chosen_key = DEMO_GROQ_API_KEY

            if not chosen_key:
                # 3. Master server key fallback
                chosen_key = cfg["server_key"]()

            logger.info(
                f"[LLM RESOLVE] Provider: {prefix} ({clean_model}) | "
                f"Source: {'BYOK (User Key)' if is_byok else ('Dedicated Demo Key' if (is_demo and chosen_key in (DEMO_OPENROUTER_API_KEY, DEMO_GROQ_API_KEY)) else 'Master Server Default')} | "
                f"Key: {mask_key(chosen_key)}"
            )

            client = OpenAI(base_url=CUSTOM_LLM_BASE_URL or cfg["base_url"], api_key=chosen_key or "no-key")
            return client, clean_model

    # Fallback for models without prefix
    chosen_key = user_keys.get("openrouter")
    if not chosen_key and is_demo and DEMO_OPENROUTER_API_KEY:
        chosen_key = DEMO_OPENROUTER_API_KEY
    if not chosen_key:
        chosen_key = os.environ.get("OPENROUTER_API_KEY", OPENROUTER_API_KEY)

    client = OpenAI(base_url=CUSTOM_LLM_BASE_URL or OPENROUTER_BASE_URL, api_key=chosen_key or "no-key")
    return client, raw


def get_llm_client(model_name: str | None = None, user_keys: dict[str, str] | None = None) -> OpenAI:
    client, _ = resolve_llm(model_name, user_keys=user_keys)
    return client


def normalize_model_for_provider(model_name: str) -> str:
    _, clean = resolve_llm(model_name)
    return clean


# Search ground enforcement
FORCE_MIN_SEARCHES = True  # when True, model must search at least MIN_SEARCHES times
MIN_SEARCHES = 3  # minimum searches floor

# Batch Execution Concurrency
CONCURRENT_WORKERS = 1  # sequential execution to prevent in-flight credit budget exhaustion

# Prompt Variant Generation
DEFAULT_VARIANT_COUNT = 5
MAX_VARIANT_COUNT = 10
