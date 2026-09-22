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


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("prompts.id"))
    round: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    raw_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    queries: Mapped[list["RunQuery"]] = relationship(back_populates="run")
    sources: Mapped[list["RunSource"]] = relationship(back_populates="run")
    target_mentions: Mapped[list["Mention"]] = relationship(back_populates="run")
    analysis: Mapped["Analysis | None"] = relationship(
        back_populates="run", uselist=False
    )
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("run_batches.id"), nullable=True)


class RunQuery(Base):
    __tablename__ = "run_queries"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"))
    query: Mapped[str] = mapped_column(Text)

    run: Mapped["Run"] = relationship(back_populates="queries")


class RunSource(Base):
    __tablename__ = "run_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"))
    url: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    cited: Mapped[bool] = mapped_column(Boolean, default=False)

    run: Mapped["Run"] = relationship(back_populates="sources")


class Mention(Base):
    __tablename__ = "mentions"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"))
    sentence: Mapped[str] = mapped_column(Text)
    matched_as: Mapped[str] = mapped_column(String(100))

    run: Mapped["Run"] = relationship(back_populates="target_mentions")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id"), unique=True)
    other_brands: Mapped[list] = mapped_column(JSON, default=list)
    target_sentiment: Mapped[str] = mapped_column(String(20))
    target_remark: Mapped[str] = mapped_column(Text)

    run: Mapped["Run"] = relationship(back_populates="analysis")


class RunBatch(Base):
    __tablename__ = "run_batches"

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
