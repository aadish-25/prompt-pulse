from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas

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
