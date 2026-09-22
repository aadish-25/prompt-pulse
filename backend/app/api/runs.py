import time
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.db import SessionLocal, get_db
from app import models, schemas
from app.services.llm import run_prompt
from app.services.runner import execute_single_run, execute_batch

router = APIRouter()


@router.post("/prompts/{prompt_id}/run-once", response_model=schemas.RunOut)
def run_once(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")

    project = db.get(models.Project, prompt.project_id)
    return execute_single_run(db, prompt, project)


def _run_batch_background(batch_id: int, project_id: int, rounds: int):
    db = SessionLocal()  # background tasks need their own session, not the request's
    try:
        execute_batch(db, batch_id, project_id, rounds)
    except Exception as e:
        # something crashed outside of a single run (e.g. DB unreachable) —
        # mark the batch failed so it doesn't stay stuck at "running" forever
        try:
            batch = db.get(models.RunBatch, batch_id)
            if batch:
                batch.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/projects/{project_id}/runs", response_model=schemas.BatchOut)
def start_batch(
    project_id: int,
    body: schemas.BatchCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    prompt_count = (
        db.query(models.Prompt).filter_by(project_id=project_id, active=True).count()
    )
    if prompt_count == 0:
        raise HTTPException(400, "Project has no active prompts")

    batch = models.RunBatch(
        project_id=project_id, rounds=body.rounds, total_runs=prompt_count * body.rounds
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    background_tasks.add_task(_run_batch_background, batch.id, project_id, body.rounds)
    return batch


@router.get("/batches/{batch_id}", response_model=schemas.BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(models.RunBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    return batch
