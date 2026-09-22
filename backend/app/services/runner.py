import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models
from app.config import CONCURRENT_WORKERS
from app.services.llm import run_prompt
from app.services.extraction import find_target_mentions, analyze_answer


def execute_single_execution(
    db: Session,
    prompt: models.Prompt,
    project: models.Project,
    round_num: int = 1,
    batch_id: int | None = None,
    model: str | None = None,
) -> models.PromptExecution:
    execution = models.PromptExecution(
        prompt_id=prompt.id, round=round_num, batch_id=batch_id, status="running"
    )
    db.add(execution)
    db.commit()  # establishes execution.id so relationships can reference it

    start = time.time()
    try:
        result = run_prompt(prompt.text, model=model)
        mentions = find_target_mentions(
            result.answer, project.brand_name, project.aliases
        )
        analysis = analyze_answer(result.answer, project.brand_name)

        execution.raw_answer = result.answer
        execution.model = result.model
        execution.duration_ms = int((time.time() - start) * 1000)
        execution.status = "done"
        execution.search_queries = [
            models.SearchQuery(query=q) for q in result.queries
        ]
        execution.web_search_results = [
            models.WebSearchResult(
                url=s.url,
                domain=s.domain,
                title=s.title,
                snippet=s.content,
                cited=s.cited,
                raw_response=s.raw_response,
            )
            for s in result.sources
        ]
        execution.brand_mentions = [
            models.BrandMention(sentence=m.sentence, matched_as=m.matched_as)
            for m in mentions
        ]
        execution.analysis = models.ExecutionAnalysis(
            other_brands=analysis.other_brands,
            target_sentiment=analysis.target_sentiment,
            target_remark=analysis.target_remark,
        )
    except Exception as e:
        db.rollback()  # clear any partial writes from the failed attempt
        execution.status = "failed"
        execution.error = str(e)
        execution.duration_ms = int((time.time() - start) * 1000)

    db.commit()
    db.refresh(execution)
    return execution


def _worker_execute_prompt(
    prompt_id: int,
    project_id: int,
    round_num: int,
    batch_id: int,
    model: str | None,
) -> bool:
    """Worker function for concurrent thread execution. Uses its own dedicated DB session."""
    worker_db = SessionLocal()
    try:
        prompt = worker_db.get(models.Prompt, prompt_id)
        project = worker_db.get(models.Project, project_id)
        if not prompt or not project:
            return False
        execution = execute_single_execution(
            worker_db,
            prompt,
            project,
            round_num=round_num,
            batch_id=batch_id,
            model=model,
        )
        return execution.status == "done"
    except Exception:
        return False
    finally:
        worker_db.close()


def execute_batch(
    db: Session,
    batch_id: int,
    project_id: int,
    rounds: int,
    model: str | None = None,
):
    project = db.get(models.Project, project_id)
    prompts = (
        db.query(models.Prompt).filter_by(project_id=project_id, active=True).all()
    )

    batch = db.get(models.TrackingBatch, batch_id)
    batch.status = "running"
    db.commit()

    prompt_ids = [p.id for p in prompts]

    for round_num in range(1, rounds + 1):
        with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
            futures = [
                executor.submit(
                    _worker_execute_prompt,
                    pid,
                    project_id,
                    round_num,
                    batch_id,
                    model,
                )
                for pid in prompt_ids
            ]
            for future in as_completed(futures):
                is_done = future.result()
                batch = db.get(models.TrackingBatch, batch_id)
                if is_done:
                    batch.completed_runs += 1
                else:
                    batch.failed_runs += 1
                db.commit()

    batch.status = "done"
    db.commit()
