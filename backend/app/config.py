import os
from dotenv import load_dotenv

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
    # AgentRouter (third-party gateway with multi-model relay)
    "AR: gpt-4o-mini",
    "AR: gpt-4o",
    "AR: claude-3-5-sonnet",
    "AR: gemini-1.5-flash",
    "AR: deepseek-chat",
    # DeepSeek Direct
    "DS: deepseek-chat",
    "DS: deepseek-reasoner",
]

DEFAULT_MODEL = "OR: openai/gpt-4o-mini"
MODEL = DEFAULT_MODEL


def resolve_llm(model_name: str | None = None) -> tuple[OpenAI, str]:
    """
    Parses prefix from model_name (e.g. 'OR: openai/gpt-4o-mini', 'GROQ: openai/gpt-oss-120b',
    'AR: gpt-4o-mini', 'DS: deepseek-chat') and returns an initialized OpenAI client
    and the clean target model string for that provider.
    """
    raw = (model_name or MODEL or DEFAULT_MODEL).strip()

    if raw.startswith("OR:") or raw.startswith("openrouter:"):
        clean_model = raw.split(":", 1)[1].strip()
        client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=OPENROUTER_API_KEY or CUSTOM_LLM_API_KEY)
        return client, clean_model

    if raw.startswith("GROQ:") or raw.startswith("groq:"):
        clean_model = raw.split(":", 1)[1].strip()
        client = OpenAI(base_url=GROQ_BASE_URL, api_key=GROQ_API_KEY or CUSTOM_LLM_API_KEY)
        return client, clean_model

    if raw.startswith("AR:") or raw.startswith("agentrouter:"):
        clean_model = raw.split(":", 1)[1].strip()
        client = OpenAI(base_url=AGENTROUTER_BASE_URL, api_key=AGENTROUTER_API_KEY or CUSTOM_LLM_API_KEY)
        return client, clean_model

    if raw.startswith("DS:") or raw.startswith("deepseek:"):
        clean_model = raw.split(":", 1)[1].strip()
        client = OpenAI(base_url=DEEPSEEK_BASE_URL, api_key=DEEPSEEK_API_KEY or CUSTOM_LLM_API_KEY)
        return client, clean_model

    # Fallback for models without prefix
    if CUSTOM_LLM_BASE_URL and CUSTOM_LLM_API_KEY:
        client = OpenAI(base_url=CUSTOM_LLM_BASE_URL, api_key=CUSTOM_LLM_API_KEY)
        return client, raw

    if raw.startswith("openai/") or raw.startswith("google/") or raw.startswith("meta-llama/"):
        client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=OPENROUTER_API_KEY or CUSTOM_LLM_API_KEY)
        return client, raw

    if GROQ_API_KEY and not OPENROUTER_API_KEY:
        client = OpenAI(base_url=GROQ_BASE_URL, api_key=GROQ_API_KEY)
        return client, raw

    if AGENTROUTER_API_KEY and not OPENROUTER_API_KEY:
        client = OpenAI(base_url=AGENTROUTER_BASE_URL, api_key=AGENTROUTER_API_KEY)
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
