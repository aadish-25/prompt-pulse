from pydantic import BaseModel


class ProjectCreate(BaseModel):
    brand_name: str
    domain: list[str] = []
    aliases: list[str] = []
    competitors: list[str] = []


class ProjectOut(ProjectCreate):
    id: int
    model_config = {"from_attributes": True}


class PromptCreate(BaseModel):
    text: str


class PromptUpdate(BaseModel):
    active: bool


class PromptOut(BaseModel):
    id: int
    project_id: int
    text: str
    active: bool
    model_config = {"from_attributes": True}
