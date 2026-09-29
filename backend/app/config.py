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
SUPPORTED_MODELS = ['OR: openai/gpt-4o-mini']
DEFAULT_MODEL = 'OR: openai/gpt-4o-mini'
MODEL = DEFAULT_MODEL
