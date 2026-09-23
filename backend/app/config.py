import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ROUNDS = 1
MAX_SEARCH_STEPS = 5

# Provider API Keys
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
AGENTROUTER_API_KEY = os.environ.get("AGENTROUTER_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
CUSTOM_LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
CUSTOM_LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")

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
    "GROQ: openai/gpt-oss-120b",
    "GROQ: qwen/qwen3.8-27b",
    "GROQ: openai/gpt-oss-20b",
    # DeepSeek Direct
    "DS: deepseek-chat",
    "DS: deepseek-reasoner",
]

DEFAULT_MODEL = "OR: openai/gpt-4o-mini"
MODEL = DEFAULT_MODEL


# Dictionary mapping provider prefixes to their Base URLs and API Keys
PROVIDER_CONFIG = {
    "OR": {
        "base_url": OPENROUTER_BASE_URL,
        "api_key": lambda: os.environ.get("OPENROUTER_API_KEY", OPENROUTER_API_KEY) or CUSTOM_LLM_API_KEY,
    },
    "GROQ": {
        "base_url": GROQ_BASE_URL,
        "api_key": lambda: os.environ.get("GROQ_API_KEY", GROQ_API_KEY) or CUSTOM_LLM_API_KEY,
    },
    "AR": {
        "base_url": AGENTROUTER_BASE_URL,
        "api_key": lambda: os.environ.get("AGENTROUTER_API_KEY", AGENTROUTER_API_KEY) or CUSTOM_LLM_API_KEY,
    },
    "DS": {
        "base_url": DEEPSEEK_BASE_URL,
        "api_key": lambda: os.environ.get("DEEPSEEK_API_KEY", DEEPSEEK_API_KEY) or CUSTOM_LLM_API_KEY,
    },
}


def resolve_llm(model_name: str | None = None) -> tuple[OpenAI, str]:
    """
    Parses prefix from model_name (e.g. 'OR: openai/gpt-4o-mini', 'GROQ: openai/gpt-oss-120b',
    'AR: gpt-4o-mini', 'DS: deepseek-chat') using PROVIDER_CONFIG dictionary and returns
    an initialized OpenAI client with the matching Base URL and API Key.
    """
    raw = (model_name or MODEL or DEFAULT_MODEL).strip()

    if ":" in raw:
        prefix, clean_model = raw.split(":", 1)
        prefix = prefix.strip().upper()
        clean_model = clean_model.strip()

        cfg = PROVIDER_CONFIG.get(prefix)
        if cfg:
            client = OpenAI(base_url=cfg["base_url"], api_key=cfg["api_key"]())
            return client, clean_model

    # Fallback for models without prefix
    if CUSTOM_LLM_BASE_URL and CUSTOM_LLM_API_KEY:
        client = OpenAI(base_url=CUSTOM_LLM_BASE_URL, api_key=CUSTOM_LLM_API_KEY)
        return client, raw

    if raw.startswith("openai/") or raw.startswith("google/") or raw.startswith("meta-llama/"):
        client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=os.environ.get("OPENROUTER_API_KEY", OPENROUTER_API_KEY))
        return client, raw

    if GROQ_API_KEY and not OPENROUTER_API_KEY:
        client = OpenAI(base_url=GROQ_BASE_URL, api_key=os.environ.get("GROQ_API_KEY", GROQ_API_KEY))
        return client, raw

    if AGENTROUTER_API_KEY and not OPENROUTER_API_KEY:
        client = OpenAI(base_url=AGENTROUTER_BASE_URL, api_key=os.environ.get("AGENTROUTER_API_KEY", AGENTROUTER_API_KEY))
        return client, raw

    # Default fallback to OpenRouter
    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=OPENROUTER_API_KEY or CUSTOM_LLM_API_KEY)
    return client, raw


def get_llm_client(model_name: str | None = None) -> OpenAI:
    client, _ = resolve_llm(model_name)
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
