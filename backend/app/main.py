import os
import time
import uuid
from fastapi import FastAPI, Depends, Request, Response
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.db import engine, Base, get_db
from app import models
from app.api import projects, runs, results, auth
from app.logger import logger

app = FastAPI(title="PromptPulse API", version="1.0.0")

# Request Logging and Profiling Middleware
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = str(uuid.uuid4())[:8]
        start_time = time.perf_counter()
        method = request.method
        path = request.url.path
        client_host = request.client.host if request.client else "unknown"

        logger.info(f"--> [{req_id}] {method} {path} from {client_host}")
        try:
            response: Response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            response.headers["X-Request-ID"] = req_id
            response.headers["X-Response-Time-Ms"] = f"{duration_ms:.2f}"
            logger.info(f"<-- [{req_id}] {method} {path} -> Status {response.status_code} ({duration_ms:.1f}ms)")
            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"<-- [{req_id}] {method} {path} -> FAILED with {type(exc).__name__}: {exc} ({duration_ms:.1f}ms)", exc_info=True)
            raise exc

app.add_middleware(RequestLoggingMiddleware)

# Allowed CORS origins
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://.*(vercel\.app|localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers for both local dev (where Vite might proxy directly) and /api standard
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(results.router, prefix="/api")

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(runs.router)
app.include_router(results.router)


