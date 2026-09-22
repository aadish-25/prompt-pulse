import time
from sqlalchemy.orm import Session
from app import models
from app.services.llm import run_prompt
from app.services.extraction import find_target_mentions, analyze_answer


def execute_single_execution(
    db: Session,
    prompt: models.Prompt,
    project: models.Project,
    round_num: int = 1,
    batch_id: int | None = None,
) -> models.PromptExecution:
    execution = models.PromptExecution(
        prompt_id=prompt.id, round=round_num, batch_id=batch_id, status="running"
    )
    db.add(execution)
    db.commit()  # establishes execution.id so relationships can reference it

    start = time.time()
    try:
        result = run_prompt(prompt.text)
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


def execute_batch(db: Session, batch_id: int, project_id: int, rounds: int):
    project = db.get(models.Project, project_id)
    prompts = (
        db.query(models.Prompt).filter_by(project_id=project_id, active=True).all()
    )

    batch = db.get(models.TrackingBatch, batch_id)
    batch.status = "running"
    db.commit()

    for round_num in range(1, rounds + 1):
        for prompt in prompts:
            execution = execute_single_execution(
                db, prompt, project, round_num=round_num, batch_id=batch_id
            )
            if execution.status == "done":
                batch.completed_runs += 1
            else:
                batch.failed_runs += 1
            db.commit()

    batch.status = "done"
    db.commit()
