import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ROUNDS = 1
MAX_SEARCH_STEPS = 5

# AI Model Configuration
MODEL = "openai/gpt-4o-mini"
SUPPORTED_MODELS = [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-haiku-4.5:batch",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct",
]

# Search ground enforcement
FORCE_MIN_SEARCHES = True  # when True, model must search at least MIN_SEARCHES times
MIN_SEARCHES = 3  # minimum searches floor

# Batch Execution Concurrency
CONCURRENT_WORKERS = 1  # sequential execution to prevent in-flight credit budget exhaustion

# Prompt Variant Generation
DEFAULT_VARIANT_COUNT = 5
MAX_VARIANT_COUNT = 10
