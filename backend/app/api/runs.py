from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Request
from sqlalchemy.orm import Session
from app.db import SessionLocal, get_db
from app import models, schemas
from app.config import MODEL, SUPPORTED_MODELS
from app.services.runner import execute_single_execution, execute_batch
from app.auth import (
    get_current_user_optional,
    get_byok_keys_from_request,
    enforce_free_tier_prompt_quota,
    UserContext,
)
from app.logger import logger
from app.core.cache import app_cache
from app.api.projects import get_project_or_404

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
    request: Request,
    model: str | None = Query(None, description="Optional model override"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user_optional),
):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")

    project = get_project_or_404(db, prompt.project_id, user)
    user_keys = get_byok_keys_from_request(request)
    byok_provided = bool(user_keys)

    # Free-tier quota guard
    enforce_free_tier_prompt_quota(
        db, prompt.project_id, user, byok_provided=byok_provided, prompt_count_requested=1
    )

    res = execute_single_execution(
        db, prompt, project, model=model, user_keys=user_keys
    )
    app_cache.invalidate_prefix(f"project:{prompt.project_id}")
    return res


def _run_batch_background(
    batch_id: int,
    project_id: int,
    rounds: int,
    model: str | None,
    user_keys: dict[str, str] | None = None,
):
    db = SessionLocal()
    try:
        execute_batch(db, batch_id, project_id, rounds, model=model, user_keys=user_keys)
        app_cache.invalidate_prefix(f"project:{project_id}")
    except Exception as exc:
        logger.error(f"[BATCH TASK ERROR] Batch #{batch_id}: {exc}", exc_info=True)
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
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user_optional),
):
    project = get_project_or_404(db, project_id, user)

    # Guard against concurrent duplicate batches on the same project
    active_batch = (
        db.query(models.TrackingBatch)
        .filter_by(project_id=project_id, status="running")
        .first()
    )
    if active_batch:
        raise HTTPException(
            409,
            f"Batch #{active_batch.id} is currently running for {project.brand_name}. Please wait for it to complete.",
        )

    prompt_count = (
        db.query(models.Prompt).filter_by(project_id=project_id, active=True).count()
    )
    if prompt_count == 0:
        raise HTTPException(400, "Project has no active prompts")

    user_keys = get_byok_keys_from_request(request)
    byok_provided = bool(user_keys)
    total_requested_runs = prompt_count * body.rounds

    # Free-tier quota guard
    enforce_free_tier_prompt_quota(
        db, project_id, user, byok_provided=byok_provided, prompt_count_requested=total_requested_runs
    )

    batch = models.TrackingBatch(
        project_id=project_id,
        rounds=body.rounds,
        total_runs=total_requested_runs,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    logger.info(
        f"[START BATCH] Created Batch #{batch.id} for Project #{project_id} ({project.brand_name}) "
        f"with {total_requested_runs} runs | BYOK: {byok_provided} | User: {user.username}"
    )

    background_tasks.add_task(
        _run_batch_background, batch.id, project_id, body.rounds, body.model, user_keys
    )
    return batch


@router.get("/batches/{batch_id}", response_model=schemas.TrackingBatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    batch = db.get(models.TrackingBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    get_project_or_404(db, batch.project_id, user)
    return batch
