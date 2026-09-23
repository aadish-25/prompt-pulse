from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from app.db import engine, Base, get_db
from app import models
from app.api import projects, runs, results

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers for local dev (where Vite rewrites /api -> /)
app.include_router(projects.router)
app.include_router(runs.router)
app.include_router(results.router)

# Also include with /api prefix for environments (like Vercel serverless) where /api/* is routed
app.include_router(projects.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(results.router, prefix="/api")


if engine:
    Base.metadata.create_all(engine)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
