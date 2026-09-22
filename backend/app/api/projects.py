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
    return db.query(models.Prompt).filter_by(project_id=project_id).all()


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


@router.post(
    "/projects/{project_id}/prompts/generate-variants",
    response_model=schemas.VariantGenerateResponse,
)
def generate_variants(
    project_id: int,
    body: schemas.VariantGenerateRequest,
    db: Session = Depends(get_db),
):
    project = get_project_or_404(db, project_id)

    raw_variants = generate_prompt_variants(
        brand_name=project.brand_name,
        seed_topic=body.seed_topic,
        count=body.count,
        competitors=project.competitors,
        aliases=project.aliases,
    )

    variants_out = [
        schemas.PromptVariantOut(
            text=v.text,
            intent_category=v.intent_category,
            rationale=v.rationale,
        )
        for v in raw_variants
    ]

    return schemas.VariantGenerateResponse(
        brand_name=project.brand_name,
        seed_topic=body.seed_topic,
        variants=variants_out,
    )
