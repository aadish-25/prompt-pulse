import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ROUNDS = 1
MAX_SEARCH_STEPS = 5

# AI Model & Provider Configuration
# Priority: AGENTROUTER_API_KEY -> OPENROUTER_API_KEY -> LLM_API_KEY
AGENTROUTER_API_KEY = os.environ.get("AGENTROUTER_API_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
CUSTOM_LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
CUSTOM_LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "").lower()


def get_llm_provider() -> str:
    if AGENTROUTER_API_KEY or LLM_PROVIDER == "agentrouter":
        return "agentrouter"
    if OPENROUTER_API_KEY or LLM_PROVIDER == "openrouter":
        return "openrouter"
    if CUSTOM_LLM_API_KEY or CUSTOM_LLM_BASE_URL:
        return "custom"
    return "openrouter"


def get_llm_client():
    from openai import OpenAI
    provider = get_llm_provider()
    if provider == "agentrouter":
        base_url = CUSTOM_LLM_BASE_URL or "https://co.agentrouter.org/v1"
        api_key = AGENTROUTER_API_KEY or CUSTOM_LLM_API_KEY
    elif provider == "custom":
        base_url = CUSTOM_LLM_BASE_URL or "https://openrouter.ai/api/v1"
        api_key = CUSTOM_LLM_API_KEY or OPENROUTER_API_KEY
    else:
        base_url = CUSTOM_LLM_BASE_URL or "https://openrouter.ai/api/v1"
        api_key = OPENROUTER_API_KEY or CUSTOM_LLM_API_KEY

    return OpenAI(base_url=base_url, api_key=api_key)


def normalize_model_for_provider(model: str) -> str:
    """
    Adapts model identifier based on active provider.
    AgentRouter expects standard names like 'gpt-4o-mini', 'gpt-4o',
    whereas OpenRouter uses 'openai/gpt-4o-mini'.
    """
    provider = get_llm_provider()
    if provider == "agentrouter":
        if model.startswith("openai/"):
            return model.removeprefix("openai/")
    return model


if get_llm_provider() == "agentrouter":
    MODEL = "gpt-4o-mini"
    SUPPORTED_MODELS = [
        "gpt-4o-mini",
        "gpt-4o",
        "claude-3-5-sonnet",
        "deepseek-chat",
    ]
else:
    MODEL = "openai/gpt-4o-mini"
    SUPPORTED_MODELS = [
        "openai/gpt-4o-mini",
        "google/gemini-2.5-flash",
        "meta-llama/llama-3.3-70b-instruct",
        "openai/gpt-4o",
    ]

# Search ground enforcement
FORCE_MIN_SEARCHES = True  # when True, model must search at least MIN_SEARCHES times
MIN_SEARCHES = 3  # minimum searches floor

# Batch Execution Concurrency
CONCURRENT_WORKERS = 1  # sequential execution to prevent in-flight credit budget exhaustion

# Prompt Variant Generation
DEFAULT_VARIANT_COUNT = 5
MAX_VARIANT_COUNT = 10
