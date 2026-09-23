from app.db import Base
from sqlalchemy import String, Text, Boolean, Integer, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_name: Mapped[str] = mapped_column(String(100))
    domain: Mapped[list] = mapped_column(JSON, default=list)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    competitors: Mapped[list] = mapped_column(JSON, default=list)
    draft_candidates: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    prompts: Mapped[list["Prompt"]] = relationship(back_populates="project")


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    text: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="prompts")


class PromptExecution(Base):
    __tablename__ = "prompt_executions"

    id: Mapped[int] = mapped_column(primary_key=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("prompts.id"))
    round: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    raw_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    search_queries: Mapped[list["SearchQuery"]] = relationship(back_populates="execution", order_by="SearchQuery.id.asc()")
    web_search_results: Mapped[list["WebSearchResult"]] = relationship(back_populates="execution", order_by="WebSearchResult.id.asc()")
    brand_mentions: Mapped[list["BrandMention"]] = relationship(back_populates="execution")
    analysis: Mapped["ExecutionAnalysis | None"] = relationship(
        back_populates="execution", uselist=False
    )
    prompt: Mapped["Prompt"] = relationship()
    batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("tracking_batches.id"), nullable=True
    )

    @property
    def prompt_text(self) -> str | None:
        return self.prompt.text if self.prompt else None


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("prompt_executions.id"))
    query: Mapped[str] = mapped_column(Text)

    execution: Mapped["PromptExecution"] = relationship(back_populates="search_queries")


class WebSearchResult(Base):
    __tablename__ = "web_search_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("prompt_executions.id"))
    url: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    cited: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    execution: Mapped["PromptExecution"] = relationship(back_populates="web_search_results")


class BrandMention(Base):
    __tablename__ = "brand_mentions"

    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("prompt_executions.id"))
    sentence: Mapped[str] = mapped_column(Text)
    matched_as: Mapped[str] = mapped_column(String(100))

    execution: Mapped["PromptExecution"] = relationship(back_populates="brand_mentions")


class ExecutionAnalysis(Base):
    __tablename__ = "execution_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("prompt_executions.id"), unique=True)
    other_brands: Mapped[list] = mapped_column(JSON, default=list)
    target_sentiment: Mapped[str] = mapped_column(String(20))
    target_remark: Mapped[str] = mapped_column(Text)

    execution: Mapped["PromptExecution"] = relationship(back_populates="analysis")


class TrackingBatch(Base):
    __tablename__ = "tracking_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    rounds: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        String(20), default="queued"
    )  # queued -> running -> done
    total_runs: Mapped[int] = mapped_column(Integer, default=0)
    completed_runs: Mapped[int] = mapped_column(Integer, default=0)
    failed_runs: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
