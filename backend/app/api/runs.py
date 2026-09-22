import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from app.services.llm import run_prompt

router = APIRouter()


@router.post("/prompts/{prompt_id}/run-once", response_model=schemas.RunOut)
def run_once(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")

    run = models.Run(prompt_id=prompt_id, status="running")
    db.add(run)
    db.commit()

    start = time.time()
    result = run_prompt(prompt.text)

    run.raw_answer = result["answer"]
    run.model = result["model"]
    run.duration_ms = int((time.time() - start) * 1000)
    run.status = "done"
    run.queries = [models.RunQuery(query=q) for q in result["queries"]]
    run.sources = [
        models.RunSource(
            url=s["url"],
            domain=s["domain"],
            title=s["title"],
            snippet=s["content"],
            cited=s["cited"],
        )
        for s in result["sources"]
    ]
    db.commit()
    db.refresh(run)
    return run
