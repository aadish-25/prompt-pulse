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


