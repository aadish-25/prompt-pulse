import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
ROUNDS = 3
MAX_SEARCH_STEPS = 5

MODEL = "openai/gpt-4o-mini"

FORCE_MIN_SEARCHES = True  # toggle: when True, model must search at least MIN_SEARCHES times before it's allowed to answer

MIN_SEARCHES = 3  # only used when FORCE_MIN_SEARCHES is True
