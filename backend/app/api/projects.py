from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from app.services.variants import generate_prompt_variants

router = APIRouter()


def get_project_or_404(db: Session, project_id: int):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/projects", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()


@router.post("/projects", response_model=schemas.ProjectOut)
def create_project(body: schemas.ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(**body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    return get_project_or_404(db, project_id)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)

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

    # 3. Delete the project
    db.delete(project)
    db.commit()
    return None


@router.post("/projects/{project_id}/prompts", response_model=schemas.PromptOut)
def add_prompt(
    project_id: int, body: schemas.PromptCreate, db: Session = Depends(get_db)
):
    get_project_or_404(db, project_id)
    prompt = models.Prompt(project_id=project_id, text=body.text)
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.post(
    "/projects/{project_id}/prompts/bulk",
    response_model=list[schemas.PromptOut],
)
def add_prompts_bulk(
    project_id: int, body: schemas.PromptBulkCreate, db: Session = Depends(get_db)
):
    get_project_or_404(db, project_id)
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
    return prompts


@router.get("/projects/{project_id}/prompts", response_model=list[schemas.PromptOut])
def list_prompts(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(db, project_id)
    return (
        db.query(models.Prompt)
        .filter_by(project_id=project_id)
        .order_by(models.Prompt.id.asc())
        .all()
    )


@router.patch("/prompts/{prompt_id}", response_model=schemas.PromptOut)
def update_prompt(
    prompt_id: int, body: schemas.PromptUpdate, db: Session = Depends(get_db)
):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    prompt.active = body.active
    db.commit()
    db.refresh(prompt)
    return prompt


@router.delete("/prompts/{prompt_id}", status_code=204)
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.get(models.Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")

    executions = db.query(models.PromptExecution).filter_by(prompt_id=prompt_id).all()
    for ex in executions:
        db.query(models.SearchQuery).filter_by(execution_id=ex.id).delete()
        db.query(models.WebSearchResult).filter_by(execution_id=ex.id).delete()
        db.query(models.BrandMention).filter_by(execution_id=ex.id).delete()
        db.query(models.ExecutionAnalysis).filter_by(execution_id=ex.id).delete()
        db.delete(ex)

    db.delete(prompt)
    db.commit()
    return None


from app.config import MODEL


@router.post(
    "/projects/{project_id}/prompts/generate-variants",
    response_model=schemas.VariantGenerateResponse,
)
def generate_variants(
    project_id: int,
    body: schemas.VariantGenerateRequest | None = None,
    db: Session = Depends(get_db),
):
    project = get_project_or_404(db, project_id)
    count = body.count if body else 10
    selected_model = (body.model.strip() if body and body.model else None) or MODEL
    seed_topic = (body.seed_topic.strip() if body and body.seed_topic else None)

    print("\n" + "=" * 60)
    print(f"[VARIANT GENERATION REQUEST]")
    print(f"  Project:    {project.brand_name} (ID: {project.id})")
    print(f"  Model:      {selected_model}")
    print(f"  Count:      {count}")
    print(f"  Seed Topic: {seed_topic or 'Auto-deduce'}")
    print("=" * 60 + "\n", flush=True)

    raw_variants = generate_prompt_variants(
        brand_name=project.brand_name,
        count=count,
        competitors=project.competitors,
        aliases=project.aliases,
        domains=project.domain,
        seed_topic=seed_topic,
        model=selected_model,
    )

    variants_out = [
        schemas.PromptVariantOut(
            text=v.text,
            intent_category=v.intent_category,
            rationale=v.rationale,
        )
    # Automatically persist newly generated draft candidates into PostgreSQL
    candidate_dicts = [
        {
            "id": f"cand_{project.id}_{idx}_{v.intent_category}",
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
):
    """Saves un-added candidate drafts directly in Neon PostgreSQL."""
    project = get_project_or_404(db, project_id)
    project.draft_candidates = payload.candidates
    db.commit()
    db.refresh(project)
    return project
