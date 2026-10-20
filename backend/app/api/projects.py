import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from app.config import MODEL
from app.services.variants import generate_prompt_variants
from app.auth import get_byok_keys_from_request, get_current_user_optional, UserContext
from app.logger import logger, log_span
from app.core.cache import app_cache
from app.services.intent import classify_prompt_intent, IntentClassification

router = APIRouter()


def get_project_or_404(db: Session, project_id: int, user: UserContext | None = None):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if user and not user.is_admin:
        if user.user_id and project.owner_id != user.user_id:
            raise HTTPException(404, "Project not found")
        if not user.user_id and project.owner_id is not None:
            raise HTTPException(404, "Project not found")
    return project


def get_prompt_or_404(db: Session, prompt_id: int, user: UserContext):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    get_project_or_404(db, prompt.project_id, user)
    return prompt


@router.get("/projects", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    cache_key = f"projects:list:{user.user_id or user.role}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached
    query = db.query(models.Project)
    if not user.is_admin:
        query = query.filter(models.Project.owner_id == (user.user_id if user.user_id else None))
    projects = query.order_by(models.Project.id.asc()).all()
    app_cache.set(cache_key, projects, ttl_seconds=60.0)
    return projects


@router.get("/cache/stats")
def get_cache_stats():
    """Returns real-time in-memory cache hit/miss diagnostics."""
    return app_cache.stats()


@router.post("/projects", response_model=schemas.ProjectOut)
def create_project(body: schemas.ProjectCreate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    project = models.Project(**body.model_dump(), owner_id=user.user_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    app_cache.invalidate_prefix("projects:list:")
    logger.info(f"[PROJECT CREATED] ID: {project.id} | Brand: {project.brand_name}")
    return project


@router.get("/projects/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    proj = get_project_or_404(db, project_id, user)
    cached = app_cache.get(f"project:{project_id}:entity")
    if cached is not None:
        return cached
    app_cache.set(f"project:{project_id}:entity", proj, ttl_seconds=60.0)
    return proj


@router.patch("/projects/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, body: schemas.ProjectUpdate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    project = get_project_or_404(db, project_id, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(project, field, value)
    db.commit()
    db.refresh(project)
    app_cache.invalidate_prefix("projects:list:")
    app_cache.delete(f"project:{project_id}:entity")
    return project


