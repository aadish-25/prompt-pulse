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


@router.get("/projects/{project_id}/settings")
def get_project_settings(project_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    get_project_or_404(db, project_id, user)
    settings = db.get(models.ProjectSettings, project_id)
    if not settings:
        return {"project_id": project_id, "brand_context": {}, "models": [], "schedule": {"frequency": "manual", "enabled": False, "time": "09:00"}}
    return {"project_id": project_id, "brand_context": settings.brand_context or {}, "models": settings.models or [], "schedule": settings.schedule or {}}


@router.put("/projects/{project_id}/settings")
def update_project_settings(project_id: int, body: schemas.ProjectSettingsUpdate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    get_project_or_404(db, project_id, user)
    settings = db.get(models.ProjectSettings, project_id)
    if not settings:
        settings = models.ProjectSettings(project_id=project_id)
        db.add(settings)
    settings.brand_context = body.brand_context
    settings.models = body.models
    settings.schedule = body.schedule
    db.commit()
    db.refresh(settings)
    return {"project_id": project_id, "brand_context": settings.brand_context, "models": settings.models, "schedule": settings.schedule}


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    project = get_project_or_404(db, project_id, user)

    # Invalidate cache
    app_cache.invalidate_prefix("projects:list:")
    app_cache.invalidate_prefix(f"project:{project_id}")

    # 1. Cascade delete all prompts and associated executions
    prompts = db.query(models.Prompt).filter_by(project_id=project_id).all()
    for p in prompts:
        executions = db.query(models.PromptExecution).filter_by(prompt_id=p.id).all()
        for ex in executions:
            db.query(models.SearchQuery).filter_by(execution_id=ex.id).delete()
            db.query(models.WebSearchResult).filter_by(execution_id=ex.id).delete()
            db.query(models.BrandMention).filter_by(execution_id=ex.id).delete()
            db.query(models.ExecutionAnalysis).filter_by(execution_id=ex.id).delete()
            db.delete(ex)
        db.delete(p)

    # 2. Cascade delete all tracking batches
    db.query(models.TrackingBatch).filter_by(project_id=project_id).delete()

    # 3. Delete project-level settings before removing the project.
    settings = db.get(models.ProjectSettings, project_id)
    if settings:
        db.delete(settings)

    # 4. Delete the project
    db.delete(project)
    db.commit()
    logger.info(f"[PROJECT DELETED] ID: {project_id} and all cascaded relations")
    return None


@router.post("/projects/{project_id}/prompts", response_model=schemas.PromptOut)
def add_prompt(
    project_id: int, body: schemas.PromptCreate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)
):
    get_project_or_404(db, project_id, user)
    prompt = models.Prompt(project_id=project_id, text=body.text.strip())
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    app_cache.invalidate_prefix(f"project:{project_id}")
    logger.info(f"[PROMPT ADDED] ID #{prompt.id} -> Project #{project_id}")
    intent_info = classify_prompt_intent(prompt.text)
    return schemas.PromptOut(
        id=prompt.id,
        project_id=prompt.project_id,
        text=prompt.text,
        active=prompt.active,
        intent=intent_info.intent,
        intent_display=intent_info.display_name,
    )


@router.post(
    "/projects/{project_id}/prompts/bulk",
    response_model=list[schemas.PromptOut],
)
def add_prompts_bulk(
    project_id: int, body: schemas.PromptBulkCreate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)
):
    get_project_or_404(db, project_id, user)
    prompts = [
        models.Prompt(project_id=project_id, text=text.strip())
        for text in body.texts
        if text.strip()
    ]
    if not prompts:
        raise HTTPException(400, "No valid prompt texts provided")

    db.add_all(prompts)
    db.commit()
    for p in prompts:
        db.refresh(p)
    app_cache.invalidate_prefix(f"project:{project_id}")
    logger.info(f"[PROMPTS BULK ADDED] {len(prompts)} prompts -> Project #{project_id}")
    return prompts


@router.get("/projects/{project_id}/prompts", response_model=list[schemas.PromptOut])
def list_prompts(project_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    get_project_or_404(db, project_id, user)
    prompts = (
        db.query(models.Prompt)
        .filter_by(project_id=project_id)
        .order_by(models.Prompt.id.asc())
        .all()
    )
    res = []
    for p in prompts:
        intent_info = classify_prompt_intent(p.text)
        res.append(
            schemas.PromptOut(
                id=p.id,
                project_id=p.project_id,
                text=p.text,
                active=p.active,
                intent=intent_info.intent,
                intent_display=intent_info.display_name,
            )
        )
    return res


@router.patch("/prompts/{prompt_id}", response_model=schemas.PromptOut)
def update_prompt(
    prompt_id: int, body: schemas.PromptUpdate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)
):
    prompt = get_prompt_or_404(db, prompt_id, user)
    prompt.active = body.active
    db.commit()
    db.refresh(prompt)
    app_cache.invalidate_prefix(f"project:{prompt.project_id}")
    return prompt


@router.patch("/prompts/{prompt_id}/content", response_model=schemas.PromptOut)
def update_prompt_content(prompt_id: int, body: schemas.PromptContentUpdate, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    prompt = get_prompt_or_404(db, prompt_id, user)
    prompt.text = body.text.strip()
    if not prompt.text:
        raise HTTPException(422, "Prompt text cannot be empty")
    db.commit()
    db.refresh(prompt)
    app_cache.invalidate_prefix(f"project:{prompt.project_id}")
    intent_info = classify_prompt_intent(prompt.text)
    return schemas.PromptOut(id=prompt.id, project_id=prompt.project_id, text=prompt.text, active=prompt.active, intent=intent_info.intent, intent_display=intent_info.display_name)


@router.delete("/prompts/{prompt_id}", status_code=204)
def delete_prompt(prompt_id: int, db: Session = Depends(get_db), user: UserContext = Depends(get_current_user_optional)):
    prompt = get_prompt_or_404(db, prompt_id, user)

    executions = db.query(models.PromptExecution).filter_by(prompt_id=prompt_id).all()
    for ex in executions:
        db.query(models.SearchQuery).filter_by(execution_id=ex.id).delete()
        db.query(models.WebSearchResult).filter_by(execution_id=ex.id).delete()
        db.query(models.BrandMention).filter_by(execution_id=ex.id).delete()
        db.query(models.ExecutionAnalysis).filter_by(execution_id=ex.id).delete()
        db.delete(ex)

    project_id = prompt.project_id
    db.delete(prompt)
    db.commit()
    app_cache.invalidate_prefix(f"project:{project_id}")
    return None


@router.post(
    "/projects/{project_id}/prompts/generate-variants",
    response_model=schemas.VariantGenerateResponse,
)
def generate_variants(
    project_id: int,
    request: Request,
    body: schemas.VariantGenerateRequest | None = None,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user_optional),
):
    project = get_project_or_404(db, project_id, user)
    count = body.count if body else 10
    selected_model = (body.model.strip() if body and body.model else None) or MODEL
    seed_topic = (body.seed_topic.strip() if body and body.seed_topic else None)
    user_keys = get_byok_keys_from_request(request)

    with log_span("generate_variants_endpoint", project=project.brand_name, model=selected_model):
        raw_variants = generate_prompt_variants(
            brand_name=project.brand_name,
            count=count,
            competitors=project.competitors,
            aliases=project.aliases,
            domains=project.domain,
            seed_topic=seed_topic,
            model=selected_model,
            user_keys=user_keys,
        )

        variants_out = [
            schemas.PromptVariantOut(
                text=v.text,
                intent_category=v.intent_category,
                rationale=v.rationale,
            )
            for v in raw_variants
        ]

        # Automatically persist newly generated draft candidates into PostgreSQL with unique collision-resistant IDs
        candidate_dicts = [
            {
                "id": f"cand_{project.id}_{idx}_{hashlib.md5(v.text.encode()).hexdigest()[:6]}",
                "prompt": v.text,
                "topic": v.intent_category,
                "intent": "Natural Search",
                "rationale": v.rationale,
            }
            for idx, v in enumerate(variants_out)
        ]
        project.draft_candidates = candidate_dicts
        db.commit()

        return schemas.VariantGenerateResponse(
            brand_name=project.brand_name,
            variants=variants_out,
            seed_topic=seed_topic,
            model=selected_model,
        )


@router.put("/projects/{project_id}/candidates", response_model=schemas.ProjectOut)
def update_project_candidates(
    project_id: int,
    payload: schemas.ProjectCandidatesUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user_optional),
):
    """Saves un-added candidate drafts directly in the project store."""
    project = get_project_or_404(db, project_id, user)
    project.draft_candidates = payload.candidates
    db.commit()
    db.refresh(project)
    return project
