import sys
import os

# Add backend directory to sys.path so app imports work smoothly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi import FastAPI
from mangum import Mangum
from app.main import app as backend_app

# Create a top-level FastAPI app mounted under /api
# to perfectly match the incoming /api/* request paths in production
app = FastAPI()
app.mount("/api", backend_app)

# Fallback root handler (e.g. for /health or /api/health)
@app.get("/health")
def root_health():
    return {"status": "ok"}

handler = Mangum(app, lifespan="off")
