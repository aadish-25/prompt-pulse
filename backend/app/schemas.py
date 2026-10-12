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


class PromptBulkCreate(BaseModel):
    texts: list[str]


class PromptUpdate(BaseModel):
    active: bool


class PromptOut(BaseModel):
    id: int
    project_id: int
    text: str
    active: bool
    intent: str | None = None
    intent_display: str | None = None
    model_config = {"from_attributes": True}


class PromptVariantOut(BaseModel):
    text: str
    intent_category: str
    rationale: str


class VariantGenerateRequest(BaseModel):
    count: int = Field(default=10, ge=1, le=10)
    seed_topic: str | None = None
    model: str | None = None


class VariantGenerateResponse(BaseModel):
    brand_name: str
    variants: list[PromptVariantOut]
    seed_topic: str | None = None
    model: str | None = None


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
    batch_id: int | None = None
    created_at: datetime | None = None
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


# ------------------------------------------------------------------------------
# Multi-LLM Comparison Schemas
# ------------------------------------------------------------------------------
class MultiLLMCompareRequest(BaseModel):
    prompt_id: int | None = None
    prompt_text: str | None = None


class ModelEvaluationResultOut(BaseModel):
    model_id: str
    display_name: str
    provider: str
    mentioned: bool
    rank: int | None = None
    sentiment: str
    summary: str
    full_response: str
    citations: list[str] = []
    latency_ms: float
    error: str | None = None


class MultiLLMComparisonReportOut(BaseModel):
    prompt_id: int | None = None
    prompt_text: str
    brand_name: str
    models_evaluated: int
    models_mentioning_brand: int
    visibility_score_pct: float
    evaluations: list[ModelEvaluationResultOut]


# ------------------------------------------------------------------------------
# Gap Analysis ("Fix My Ranking") Schemas
# ------------------------------------------------------------------------------
class ActionableRecommendationOut(BaseModel):
    category: str
    priority: str
    title: str
    rationale: str
    implementation_steps: list[str]


class CompetitorDisplacementOut(BaseModel):
    prompt_id: int
    prompt_text: str
    brand_mentioned: bool
    competitors_present: list[str]
    citations_observed: list[str]
    lost_to_competitor: str


class GapAnalysisReportOut(BaseModel):
    project_id: int
    brand_name: str
    total_audited_runs: int
    win_rate_pct: float
    displacement_count: int
    top_displacing_competitors: list[dict]
    missing_high_authority_domains: list[str]
    displacements: list[CompetitorDisplacementOut]
    recommendations: list[ActionableRecommendationOut]


# ------------------------------------------------------------------------------
# Intent Classification Schemas
# ------------------------------------------------------------------------------
class IntentClassificationRequest(BaseModel):
    text: str


class IntentClassificationOut(BaseModel):
    intent: str
    display_name: str
    confidence: float
    description: str
    signals_detected: list[str]



class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


