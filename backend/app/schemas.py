from pydantic import BaseModel, Field


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


class PromptBulkCreate(BaseModel):
    texts: list[str]


class PromptUpdate(BaseModel):
    active: bool


class PromptOut(BaseModel):
    id: int
    project_id: int
    text: str
    active: bool
    model_config = {"from_attributes": True}


class PromptVariantOut(BaseModel):
    text: str
    intent_category: str
    rationale: str


class VariantGenerateRequest(BaseModel):
    seed_topic: str
    count: int = Field(default=5, ge=1, le=10)


class VariantGenerateResponse(BaseModel):
    brand_name: str
    seed_topic: str
    variants: list[PromptVariantOut]


class SearchQueryOut(BaseModel):
    query: str
    model_config = {"from_attributes": True}


class BrandMentionOut(BaseModel):
    sentence: str
    matched_as: str
    model_config = {"from_attributes": True}


class ExecutionAnalysisOut(BaseModel):
    other_brands: list[str]
    target_sentiment: str
    target_remark: str
    model_config = {"from_attributes": True}


class WebSearchResultOut(BaseModel):
    url: str
    domain: str
    title: str | None
    cited: bool
    snippet: str | None
    raw_response: dict | None = None
    model_config = {"from_attributes": True}


class PromptExecutionOut(BaseModel):
    id: int
    prompt_id: int
    prompt_text: str | None = None
    round: int
    status: str
    raw_answer: str | None
    error: str | None
    model: str | None
    duration_ms: int | None
    search_queries: list[SearchQueryOut] = []
    web_search_results: list[WebSearchResultOut] = []
    brand_mentions: list[BrandMentionOut] = []
    analysis: ExecutionAnalysisOut | None = None
    model_config = {"from_attributes": True}


class TrackingBatchCreate(BaseModel):
    rounds: int = Field(default=1, ge=1, le=3)
    model: str | None = None


class TrackingBatchOut(BaseModel):
    id: int
    status: str
    total_runs: int
    completed_runs: int
    failed_runs: int
    model_config = {"from_attributes": True}


class SummaryOut(BaseModel):
    total_runs: int
    mentioned_count: int
    visibility_percentage: float
    own_domain_retrieved_count: int
    own_domain_cited_count: int
    own_domain_citation_percentage: float
    sentiment_breakdown: dict[str, int]
    top_competitors: list[dict]


class DomainStatsOut(BaseModel):
    domain: str
    retrieved: int
    cited: int


class SupportedModelsOut(BaseModel):
    default_model: str
    supported_models: list[str]
