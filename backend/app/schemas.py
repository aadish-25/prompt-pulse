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


class RunQueryOut(BaseModel):
    query: str
    model_config = {"from_attributes": True}


class RunSourceOut(BaseModel):
    url: str
    domain: str
    title: str | None
    cited: bool
    model_config = {"from_attributes": True}


class RunOut(BaseModel):
    id: int
    prompt_id: int
    round: int
    status: str
    raw_answer: str | None
    error: str | None
    model: str | None
    duration_ms: int | None
    queries: list[RunQueryOut] = []
    sources: list[RunSourceOut] = []
    model_config = {"from_attributes": True}
