from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import engine, Base, get_db
from app import models
from app.api import projects, runs

app = FastAPI()

app.include_router(projects.router)
app.include_router(runs.router)


Base.metadata.create_all(engine)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
