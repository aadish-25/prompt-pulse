"""
PromptPulse AI Answer Optimization & Gap Analysis Engine ("Fix My Ranking").

Performs adversarial audits of LLM answer distributions to uncover:
1. Prompts where competitors displaced the brand
2. Third-party domains citing competitors but omitting the user's brand
3. Semantic keyword/attribute gaps (features competitors won on)
4. Concrete, actionable engineering and content playbooks to win back citations and rankings.
"""
from collections import Counter
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app import models


class ActionableRecommendation(BaseModel):
    category: str  # "Content Strategy" | "Off-Site Citations" | "Schema & Technical GEO" | "Product Positioning"
    priority: str  # "HIGH" | "MEDIUM" | "LOW"
    title: str
    rationale: str
    implementation_steps: list[str]


class CompetitorDisplacement(BaseModel):
    prompt_id: int
    prompt_text: str
    brand_mentioned: bool
    competitors_present: list[str]
    citations_observed: list[str]
    lost_to_competitor: str


class GapAnalysisReport(BaseModel):
    project_id: int
    brand_name: str
    total_audited_runs: int
    win_rate_pct: float
    displacement_count: int
    top_displacing_competitors: list[dict[str, str | int]]
    missing_high_authority_domains: list[str]
    displacements: list[CompetitorDisplacement]
    recommendations: list[ActionableRecommendation]


HIGH_AUTHORITY_GEO_DOMAINS = [
    "reddit.com", "g2.com", "capterra.com", "trustradius.com",
    "github.com", "producthunt.com", "techcrunch.com", "medium.com",
    "stackshare.io", "wikipedia.org", "news.ycombinator.com"
]


def generate_gap_analysis(db: Session, project: models.Project) -> GapAnalysisReport:
    # 1. Fetch all completed executions for project
    executions = (
        db.query(models.PromptExecution)
        .join(models.Prompt)
        .filter(models.Prompt.project_id == project.id, models.PromptExecution.status == "done")
        .all()
    )

    total_runs = len(executions)
    target_domains = {d.lower().strip() for d in (project.domain or []) if d}
    target_brand_lower = project.brand_name.lower().strip()
    target_aliases = [a.lower().strip() for a in (project.aliases or []) if a]
    known_competitors = [c.strip() for c in (project.competitors or []) if c]

    displacements: list[CompetitorDisplacement] = []
    competitor_loss_counter: Counter = Counter()
    competitor_cited_domains: Counter = Counter()
    own_cited_domains: Counter = Counter()

    wins = 0

    for ex in executions:
        is_brand_mentioned = bool(ex.brand_mentions)
        if is_brand_mentioned:
            wins += 1

        # Check competitors in this execution
        detected_competitors = []
        if ex.analysis and ex.analysis.other_brands:
            detected_competitors = ex.analysis.other_brands
        else:
            # Fallback search in raw answer
            raw_text = (ex.raw_answer or "").lower()
            for comp in known_competitors:
                if comp.lower() in raw_text:
                    detected_competitors.append(comp)

        # Collect cited domains
        cited_in_run = []
        for ws in ex.web_search_results:
            d_clean = ws.domain.lower().strip()
            if ws.cited:
                cited_in_run.append(d_clean)
                if any(td in d_clean for td in target_domains):
                    own_cited_domains[d_clean] += 1
                else:
                    competitor_cited_domains[d_clean] += 1

        # If competitor was mentioned but brand was NOT mentioned -> Displacement
        if not is_brand_mentioned and detected_competitors:
            primary_loser = detected_competitors[0]
            for c in detected_competitors:
                competitor_loss_counter[c] += 1

            displacements.append(
                CompetitorDisplacement(
                    prompt_id=ex.prompt_id,
                    prompt_text=ex.prompt.text if ex.prompt else "Prompt",
                    brand_mentioned=False,
                    competitors_present=detected_competitors,
                    citations_observed=list(set(cited_in_run))[:6],
                    lost_to_competitor=primary_loser,
                )
            )

    win_rate = round((wins / total_runs * 100.0), 1) if total_runs > 0 else 0.0

    # High authority domains cited for competitors where target brand is absent
    missing_authority_domains = []
    for auth_dom in HIGH_AUTHORITY_GEO_DOMAINS:
        if auth_dom in competitor_cited_domains and auth_dom not in own_cited_domains:
            missing_authority_domains.append(auth_dom)

    # Compile actionable recommendations
    recommendations: list[ActionableRecommendation] = []

    if displacements:
        top_rival = competitor_loss_counter.most_common(1)[0][0] if competitor_loss_counter else "Competitors"
        recommendations.append(
            ActionableRecommendation(
                category="Content Strategy",
                priority="HIGH",
                title=f"Deploy Direct Versus & Comparison Hub ({project.brand_name} vs {top_rival})",
                rationale=(
                    f"LLMs frequently cite comparison pages when answering category evaluations. "
                    f"Your rival '{top_rival}' displaced you in {competitor_loss_counter[top_rival]} runs."
                ),
                implementation_steps=[
                    f"Create an authoritative `/compare/{project.brand_name.lower()}-vs-{top_rival.lower()}` landing page.",
                    "Include a detailed tabular breakdown comparing feature matrices, pricing, and API capabilities.",
                    "Structure headings with question-based H2/H3 tags that mirror natural LLM prompts.",
                    "Ensure neutral, factual tone so web crawlers and Perplexity/Gemini index it as objective research."
                ],
            )
        )

    if missing_authority_domains:
        domains_str = ", ".join(missing_authority_domains[:3])
        recommendations.append(
            ActionableRecommendation(
                category="Off-Site Citations",
                priority="HIGH",
                title=f"Establish Entity Footprint on High-Weight GEO Hubs ({domains_str})",
                rationale=(
                    "Generative search engines (Perplexity, Gemini Grounding, Tavily) heavily weight "
                    "community consensus and verified software directories over promotional brand blogs."
                ),
                implementation_steps=[
                    f"Audit and claim official profiles on {', '.join(missing_authority_domains[:3])}.",
                    "Publish technical documentation or open-source SDK snippets on GitHub with comprehensive README.",
                    "Encourage satisfied early adopters to participate in authentic discussions on relevant Reddit subreddits.",
                    "Ensure brand name, domain URL, and canonical aliases are consistent across all profiles."
                ],
            )
        )

    recommendations.append(
        ActionableRecommendation(
            category="Schema & Technical GEO",
            priority="MEDIUM",
            title="Implement Structured JSON-LD Entity Graph & FAQ Schema",
            rationale=(
                "LLM retrieval scrapers parse schema tags to verify pricing, product categorization, "
                "and entity relationships before synthesizing citations."
            ),
            implementation_steps=[
                "Embed `SoftwareApplication` or `Product` schema with explicit `offers`, `aggregateRating`, and `operatingSystem`.",
                "Inject `FAQPage` schema answering common pre-purchase questions directly on your homepage.",
                "Add `sameAs` entity links in Organization schema pointing to your official GitHub, Twitter, and LinkedIn.",
                "Verify zero syntax warnings using Google's Rich Results Test tool."
            ],
        )
    )

    top_competitors_list = [
        {"brand": c, "count": count}
        for c, count in competitor_loss_counter.most_common(5)
    ]

    return GapAnalysisReport(
        project_id=project.id,
        brand_name=project.brand_name,
        total_audited_runs=total_runs,
        win_rate_pct=win_rate,
        displacement_count=len(displacements),
        top_displacing_competitors=top_competitors_list,
        missing_high_authority_domains=missing_authority_domains,
        displacements=displacements[:15],
        recommendations=recommendations,
    )
