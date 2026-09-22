import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
ROUNDS = 3
MAX_SEARCH_STEPS = 4
