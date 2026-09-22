import time
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.db import SessionLocal, get_db
from app import models, schemas
from app.config import MODEL, SUPPORTED_MODELS
from app.services.runner import execute_single_execution, execute_batch

router = APIRouter()


@router.get("/models", response_model=schemas.SupportedModelsOut)
def get_supported_models():
    """Returns the pool of supported AI models for the frontend dropdown."""
    return schemas.SupportedModelsOut(
        default_model=MODEL,
        supported_models=SUPPORTED_MODELS,
    )


@router.post("/prompts/{prompt_id}/run-once", response_model=schemas.PromptExecutionOut)
def run_once(
    prompt_id: int,
    model: str | None = Query(None, description="Optional model override"),
    db: Session = Depends(get_db),
):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")

    project = db.get(models.Project, prompt.project_id)
    return execute_single_execution(db, prompt, project, model=model)


def _run_batch_background(
    batch_id: int, project_id: int, rounds: int, model: str | None
):
    db = SessionLocal()  # background tasks need their own session, not the request's
    try:
        execute_batch(db, batch_id, project_id, rounds, model=model)
    except Exception:
        try:
            batch = db.get(models.TrackingBatch, batch_id)
            if batch:
                batch.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/projects/{project_id}/runs", response_model=schemas.TrackingBatchOut)
def start_batch(
    project_id: int,
    body: schemas.TrackingBatchCreate,
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

    batch = models.TrackingBatch(
        project_id=project_id, rounds=body.rounds, total_runs=prompt_count * body.rounds
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    background_tasks.add_task(
        _run_batch_background, batch.id, project_id, body.rounds, body.model
    )
    return batch


@router.get("/batches/{batch_id}", response_model=schemas.TrackingBatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(models.TrackingBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    return batch
