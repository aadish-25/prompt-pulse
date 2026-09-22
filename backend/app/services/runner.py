import time
from sqlalchemy.orm import Session
from app import models
from app.services.llm import run_prompt
from app.services.extraction import find_target_mentions, analyze_answer


def execute_single_run(
    db: Session,
    prompt: models.Prompt,
    project: models.Project,
    round_num: int = 1,
    batch_id: int | None = None,
) -> models.Run:
    run = models.Run(
        prompt_id=prompt.id, round=round_num, batch_id=batch_id, status="running"
    )
    db.add(run)
    db.commit()  # establishes run.id so relationships can reference it

    start = time.time()
    try:
        result = run_prompt(prompt.text)
        mentions = find_target_mentions(
            result.answer, project.brand_name, project.aliases
        )
        analysis = analyze_answer(result.answer, project.brand_name)

        run.raw_answer = result.answer
        run.model = result.model
        run.duration_ms = int((time.time() - start) * 1000)
        run.status = "done"
        run.queries = [models.RunQuery(query=q) for q in result.queries]
        run.sources = [
            models.RunSource(
                url=s.url,
                domain=s.domain,
                title=s.title,
                snippet=s.content,
                cited=s.cited,
            )
            for s in result.sources
        ]
        run.target_mentions = [
            models.Mention(sentence=m.sentence, matched_as=m.matched_as)
            for m in mentions
        ]
        run.analysis = models.Analysis(
            other_brands=analysis.other_brands,
            target_sentiment=analysis.target_sentiment,
            target_remark=analysis.target_remark,
        )
    except Exception as e:
        db.rollback()  # clear any partial writes from the failed attempt
        run.status = "failed"
        run.error = str(e)
        run.duration_ms = int((time.time() - start) * 1000)

    db.commit()
    db.refresh(run)
    return run


def execute_batch(db: Session, batch_id: int, project_id: int, rounds: int):
    project = db.get(models.Project, project_id)
    prompts = (
        db.query(models.Prompt).filter_by(project_id=project_id, active=True).all()
    )

    batch = db.get(models.RunBatch, batch_id)
    batch.status = "running"
    db.commit()

    for round_num in range(1, rounds + 1):
        for prompt in prompts:
            run = execute_single_run(
                db, prompt, project, round_num=round_num, batch_id=batch_id
            )
            if run.status == "done":
                batch.completed_runs += 1
            else:
                batch.failed_runs += 1
            db.commit()

    batch.status = "done"
    db.commit()
