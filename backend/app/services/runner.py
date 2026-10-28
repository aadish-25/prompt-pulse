import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from sqlalchemy import update
from app.db import SessionLocal
from app import models
from app.config import CONCURRENT_WORKERS
from app.services.llm import run_prompt
from app.services.extraction import find_target_mentions, analyze_answer
from app.logger import logger, log_span


def execute_single_execution(
    db: Session,
    prompt: models.Prompt,
    project: models.Project,
    round_num: int = 1,
    batch_id: int | None = None,
    model: str | None = None,
    user_keys: dict[str, str] | None = None,
) -> models.PromptExecution:
    execution = models.PromptExecution(
        prompt_id=prompt.id, round=round_num, batch_id=batch_id, status="running"
    )
    db.add(execution)
    db.commit()

    start = time.time()
    with log_span("single_execution", execution_id=execution.id, prompt=prompt.text[:40]):
        try:
            result = run_prompt(prompt.text, model=model, user_keys=user_keys)
            mentions = find_target_mentions(
                result.answer, project.brand_name, project.aliases
            )
            analysis = analyze_answer(
                result.answer, project.brand_name, model=model, user_keys=user_keys
            )

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
            logger.error(f"[EXECUTION FAILED] Prompt #{prompt.id}: {e}", exc_info=True)
            db.rollback()
            db.expire_all()
            execution = db.get(models.PromptExecution, execution.id)
            if execution:
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
    user_keys: dict[str, str] | None = None,
) -> bool:
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
            user_keys=user_keys,
        )
        return execution.status == "done"
    except Exception as exc:
        logger.error(f"[WORKER ERROR] Prompt {prompt_id}: {exc}", exc_info=True)
        return False
    finally:
        worker_db.close()


def _increment_batch_counter(batch_id: int, is_done: bool):
    counter_db = SessionLocal()
    try:
        if is_done:
            counter_db.execute(
                update(models.TrackingBatch)
                .where(models.TrackingBatch.id == batch_id)
                .values(completed_runs=models.TrackingBatch.completed_runs + 1)
            )
        else:
            counter_db.execute(
                update(models.TrackingBatch)
                .where(models.TrackingBatch.id == batch_id)
                .values(failed_runs=models.TrackingBatch.failed_runs + 1)
            )
        counter_db.commit()
    except Exception as e:
        counter_db.rollback()
        logger.error(f"Failed to update batch counter: {e}")
    finally:
        counter_db.close()


def execute_batch(
    db: Session,
    batch_id: int,
    project_id: int,
    rounds: int,
    model: str | None = None,
    user_keys: dict[str, str] | None = None,
):
    with log_span("execute_batch", batch_id=batch_id, project_id=project_id, rounds=rounds):
        project = db.get(models.Project, project_id)
        prompts = (
            db.query(models.Prompt).filter_by(project_id=project_id, active=True).all()
        )

        batch = db.get(models.TrackingBatch, batch_id)
        if batch:
            batch.status = "running"
            db.commit()

        prompt_ids = [p.id for p in prompts]
        logger.info(f"[BATCH START] Processing {len(prompt_ids)} prompts over {rounds} round(s)")

        for round_num in range(1, rounds + 1):
            with ThreadPoolExecutor(max_workers=max(CONCURRENT_WORKERS, 1)) as executor:
                futures = {
                    executor.submit(
                        _worker_execute_prompt,
                        pid,
                        project_id,
                        round_num,
                        batch_id,
                        model,
                        user_keys,
                    ): pid
                    for pid in prompt_ids
                }
                for future in as_completed(futures):
                    try:
                        is_done = future.result()
                    except Exception:
                        is_done = False
                    _increment_batch_counter(batch_id, is_done)

        done_db = SessionLocal()
        try:
            done_db.execute(
                update(models.TrackingBatch)
                .where(models.TrackingBatch.id == batch_id)
                .values(status="done")
            )
            done_db.commit()
            logger.info(f"[BATCH DONE] Batch #{batch_id} marked as done")
        finally:
            done_db.close()
