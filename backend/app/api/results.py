from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas

router = APIRouter()


@router.get("/batches/{batch_id}/runs", response_model=list[schemas.PromptExecutionOut])
def list_batch_runs(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(models.TrackingBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    return db.query(models.PromptExecution).filter_by(batch_id=batch_id).all()


@router.get("/projects/{project_id}/results", response_model=list[schemas.PromptExecutionOut])
def project_results(
    project_id: int, round: int | None = Query(None), db: Session = Depends(get_db)
):
    q = (
        db.query(models.PromptExecution)
        .join(models.Prompt)
        .filter(models.Prompt.project_id == project_id)
    )
    if round is not None:
        q = q.filter(models.PromptExecution.round == round)
    results = q.all()
    # Sort latest batch first (descending batch_id), then execution order within batch (ascending id)
    results.sort(key=lambda x: (-(x.batch_id or 0), x.id))
    return results


@router.delete("/executions/{execution_id}", status_code=200)
def delete_execution(execution_id: int, db: Session = Depends(get_db)):
    execution = db.get(models.PromptExecution, execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    batch_id = execution.batch_id
    db.query(models.SearchQuery).filter_by(execution_id=execution.id).delete()
    db.query(models.WebSearchResult).filter_by(execution_id=execution.id).delete()
    db.query(models.BrandMention).filter_by(execution_id=execution.id).delete()
    db.query(models.ExecutionAnalysis).filter_by(execution_id=execution.id).delete()
    db.delete(execution)
    db.commit()

    if batch_id:
        remaining = db.query(models.PromptExecution).filter_by(batch_id=batch_id).count()
        if remaining == 0:
            db.query(models.TrackingBatch).filter_by(id=batch_id).delete()
            db.commit()

    return {"message": "Execution deleted successfully", "deleted_id": execution_id}


@router.delete("/projects/{project_id}/results")
def clear_project_results(project_id: int, db: Session = Depends(get_db)):
    """Deletes all executions (and cascaded search queries, results, mentions, analyses) for a project."""
    executions = (
        db.query(models.PromptExecution)
        .join(models.Prompt)
        .filter(models.Prompt.project_id == project_id)
        .all()
    )
    for ex in executions:
        db.query(models.SearchQuery).filter_by(execution_id=ex.id).delete()
        db.query(models.WebSearchResult).filter_by(execution_id=ex.id).delete()
        db.query(models.BrandMention).filter_by(execution_id=ex.id).delete()
        db.query(models.ExecutionAnalysis).filter_by(execution_id=ex.id).delete()
        db.delete(ex)

    db.query(models.TrackingBatch).filter_by(project_id=project_id).delete()
    db.commit()
    return {"message": "All execution results cleared successfully", "cleared_count": len(executions)}


@router.get("/projects/{project_id}/summary", response_model=schemas.SummaryOut)
def project_summary(project_id: int, db: Session = Depends(get_db)):
    project = db.get(models.Project, project_id)
    target_domains = (
        {d.lower().strip() for d in (project.domain or [])} if project else set()
    )

    executions = (
        db.query(models.PromptExecution)
        .join(models.Prompt)
        .filter(models.Prompt.project_id == project_id, models.PromptExecution.status == "done")
        .all()
    )
    total = len(executions)
    if total == 0:
        return schemas.SummaryOut(
            total_runs=0,
            mentioned_count=0,
            visibility_percentage=0.0,
            own_domain_retrieved_count=0,
            own_domain_cited_count=0,
            own_domain_citation_percentage=0.0,
            sentiment_breakdown={},
            top_competitors=[],
        )

    mentioned = [e for e in executions if e.brand_mentions]
    own_domain_retrieved = 0
    own_domain_cited = 0
    sentiments: dict[str, int] = {}
    competitor_counts: dict[str, int] = {}

    for e in executions:
        has_retrieved = False
        has_cited = False
        for s in e.web_search_results:
            domain_clean = s.domain.lower().strip()
            if any(td in domain_clean for td in target_domains):
                has_retrieved = True
                if s.cited:
                    has_cited = True

        if has_retrieved:
            own_domain_retrieved += 1
        if has_cited:
            own_domain_cited += 1

        if e.analysis:
            sentiments[e.analysis.target_sentiment] = (
                sentiments.get(e.analysis.target_sentiment, 0) + 1
            )
            for c in e.analysis.other_brands:
                competitor_counts[c] = competitor_counts.get(c, 0) + 1

    top_competitors = sorted(competitor_counts.items(), key=lambda x: -x[1])[:10]

    return schemas.SummaryOut(
        total_runs=total,
        mentioned_count=len(mentioned),
        visibility_percentage=round(len(mentioned) / total * 100, 1),
        own_domain_retrieved_count=own_domain_retrieved,
        own_domain_cited_count=own_domain_cited,
        own_domain_citation_percentage=round(own_domain_cited / total * 100, 1),
        sentiment_breakdown=sentiments,
        top_competitors=[{"brand": b, "count": c} for b, c in top_competitors],
    )


@router.get(
    "/projects/{project_id}/citations", response_model=list[schemas.DomainStatsOut]
)
def project_citations(project_id: int, db: Session = Depends(get_db)):
    sources = (
        db.query(models.WebSearchResult)
        .join(models.PromptExecution)
        .join(models.Prompt)
        .filter(models.Prompt.project_id == project_id)
        .all()
    )
    domain_stats: dict[str, dict] = {}
    for s in sources:
        entry = domain_stats.setdefault(s.domain, {"retrieved": 0, "cited": 0})
        entry["retrieved"] += 1
        if s.cited:
            entry["cited"] += 1

    return [
        schemas.DomainStatsOut(domain=d, retrieved=v["retrieved"], cited=v["cited"])
        for d, v in sorted(domain_stats.items(), key=lambda x: -x[1]["cited"])
    ]
