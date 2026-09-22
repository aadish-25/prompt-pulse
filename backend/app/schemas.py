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
    snippet: str | None
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
    target_mentions: list[MentionOut] = []
    analysis: AnalysisOut | None = None


class MentionOut(BaseModel):
    sentence: str
    matched_as: str
    model_config = {"from_attributes": True}


class AnalysisOut(BaseModel):
    other_brands: list[str]
    target_sentiment: str
    target_remark: str
    model_config = {"from_attributes": True}


class BatchCreate(BaseModel):
    rounds: int = 3


class BatchOut(BaseModel):
    id: int
    status: str
    total_runs: int
    completed_runs: int
    failed_runs: int
    model_config = {"from_attributes": True}


class SummaryOut(BaseModel):
    total_runs: int
    mentioned_count: int
    visibility_pct: float
    sentiment_breakdown: dict[str, int]
    top_competitors: list[dict]


class DomainStatsOut(BaseModel):
    domain: str
    retrieved: int
    cited: int
