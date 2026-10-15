from datetime import datetime
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    brand_name: str
    domain: list[str] = []
    aliases: list[str] = []
    competitors: list[str] = []


class ProjectOut(ProjectCreate):
    id: int
    draft_candidates: list[dict] = []
    model_config = {"from_attributes": True}


class ProjectCandidatesUpdate(BaseModel):
    candidates: list[dict]


class PromptCreate(BaseModel):
    text: str


