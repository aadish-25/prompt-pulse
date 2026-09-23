import sys
import os

# Add backend directory to sys.path so app imports work smoothly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from mangum import Mangum
from app.main import app

# Vercel AWS Lambda / Serverless ASGI handler
handler = Mangum(app, lifespan="off")

