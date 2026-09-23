import shutil
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

def create_document():
    doc = docx.Document()

    # Set Standard 1-inch Margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Base Normal Style (Calibri 11pt, 1.15 line spacing, 4pt space after)
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(30, 41, 59) # Slate 800

    def add_p(text, bold_prefix="", space_after=4, bullet=False):
        if bullet:
            p = doc.add_paragraph(style='List Bullet')
        else:
            p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(space_after)
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.bold = True
            r_pre.font.color.rgb = RGBColor(15, 23, 42)
        r_text = p.add_run(text)
        r_text.font.color.rgb = RGBColor(51, 65, 85)
        return p

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(15)
        r.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(12.5)
        r.font.color.rgb = RGBColor(30, 41, 59)
        return p

    # Document Header
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_t = p_title.add_run("PromptPulse: Technical Approach, Architecture & Learning Review")
    r_t.bold = True
    r_t.font.size = Pt(18)
    r_t.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_s = p_sub.add_run("POC Discussion Document — Engineering Bottlenecks, SEO/GEO Insights & Implementation Plan")
    r_s.font.size = Pt(11.5)
    r_s.font.color.rgb = RGBColor(100, 116, 139)

    # 1. How We Approached the Problem
    add_h1("1. How We Approached the Problem")
    add_p(
        "Search behavior is fundamentally shifting from traditional search engines (ten blue links) to generative AI answer "
        "engines like ChatGPT Search, Perplexity, Google AI Overviews, and Gemini. Traditional SEO tools measure keyword rankings (#1 to #10) "
        "and backlink volume, which provides zero visibility into whether an AI model mentions, recommends, compares, or cites a brand."
    )
    add_p(
        "We built PromptPulse (addressing Problem Statement A: GEO Prompt & Brand Visibility Tracker) to track brand presence inside AI-generated answers through an end-to-end workflow:"
    )
    add_p(" We create non-branded consumer search queries (e.g., 'best free online graphic design tools' rather than 'Canva') to reflect how actual consumers ask questions without brand bias.", bold_prefix="Brand-Agnostic Prompt Suites:", bullet=True)
    add_p(" The system runs an autonomous ReAct loop where the model calls Tavily Search, evaluates live web results, synthesizes an answer, and tags factual claims with bracketed citations [X].", bold_prefix="Search-Grounded Inference:", bullet=True)
    add_p(" To prevent hallucinations, brand mentions are detected via word-boundary regex and Levenshtein typo matching (0.82 ratio). A secondary Pydantic-constrained LLM call extracts competitor brands and sentiment.", bold_prefix="Dual Extraction Pipeline:", bullet=True)
    add_p(" Executions, cited URLs, search queries, mentions, and sentiment are stored relationally in Neon PostgreSQL and grouped by chronological batches.", bold_prefix="Relational Persistence:", bullet=True)

    # 2. Current Architecture
    add_h1("2. Current System Architecture")
    add_p("The current system consists of four primary components connected through defined contracts:")
    add_p(" Built with React 19, Vite, and Tailwind CSS. Provides project management, prompt suite creation, dynamic model selection (Groq open-source vs. OpenRouter), batch-first execution explorer, and optimistic deletions.", bold_prefix="1. Frontend Layer: ", bullet=True)
    add_p(" Built with FastAPI and Pydantic v2. Exposes REST endpoints for project creation, prompt variant generation, batch execution dispatch, and historical reporting.", bold_prefix="2. Backend Service: ", bullet=True)
    add_p(" Connects Tavily Search API for real-time web retrieval and routes LLM requests to OpenRouter (openai/gpt-4o-mini) and Groq (openai/gpt-oss-120b). Formats citations with [X] markers and closing manifests.", bold_prefix="3. Grounding & AI Engine: ", bullet=True)
    add_p(" Serverless Neon PostgreSQL database storing normalized tables: projects, prompts, prompt_executions, web_search_results, brand_mentions, and execution_analyses.", bold_prefix="4. Data Persistence: ", bullet=True)

    # 3. Real Breaking Points, Constraints & Bottlenecks Discovered
    add_h1("3. Real Breaking Points, Constraints & Bottlenecks Discovered")
    add_p(
        "During live implementation, testing, and evaluation, we discovered several critical engineering constraints, behavioral divergences, and operational bottlenecks:"
    )

    add_h2("3.1 Data Volume & Historical Baseline Limitations")
    add_p(
        "Because the application was built recently, there is no historical baseline data. We cannot yet observe or predict month-over-month visibility drift or algorithm update impacts. "
        "Furthermore, our testing capacity is strictly limited to small batches of 5 to 10 prompts per run. Testing larger suites (e.g. 100+ prompts) is currently blocked by free-tier token allowances, rate limits, and latency."
    )

    add_h2("3.2 Multi-Model Tracking & Observability Gaps")
    add_p(
        "While multiple models are wired up in the UI dropdown, we are not yet running standardized, concurrent multi-model benchmarking. "
        "In a complete GEO setup, the exact same prompt suite should be executed simultaneously across ChatGPT, Gemini, Claude, and Perplexity to generate cross-engine comparative visibility scores. "
        "Additionally, prompts lack versioning (we cannot track how prompt wording edits impact model recall over time), and the system lacks structured trace logging and per-step latency telemetry."
    )

    add_h2("3.3 Free-Tier Token Depletion & Concurrency Collapse")
    add_p(
        "Each prompt execution consumes between 3,000 and 4,500 tokens across system instructions, injected web snippets, synthesized answers, and structured extraction. "
        "Our original architectural plan was to fan out 5 parallel worker threads via ThreadPoolExecutor so a 5-prompt batch would finish in ~10 seconds. "
        "However, because each worker chains multiple API calls (Tavily search + ReAct LLM + extraction LLM), 5 workers generated 15+ concurrent requests simultaneously. "
        "On free-tier and shared API tiers, this immediately triggered HTTP 429 (Rate Limit Exceeded) errors and socket crashes. "
        "To guarantee execution reliability, we were forced to defensively throttle concurrency down to sequential execution, increasing batch turnaround to ~45–60 seconds."
    )

    add_h2("3.4 Tavily Crawling Depth Limits")
    add_p(
        "Tavily functions as an indexed snippet retrieval engine rather than a live recursive website crawler. "
        "For specialized B2B brands or agencies, critical service offerings, technical case studies, and perspectives are often nested 3 or 4 levels deep in the URL hierarchy. "
        "Tavily frequently misses these nested sub-pages and instead returns high-level directory aggregators (e.g. Tracxn, GoodFirms). "
        "Toggling search_depth from 'basic' to 'advanced' increased snippet length, but did not resolve the crawling depth limitation."
    )

    add_h2("3.5 The Mention vs. Citation Asymmetry Problem")
    add_p(
        "Through empirical testing across different brands, we discovered a core divergence in generative AI behavior:\n"
        "• Pure Conceptual Prompts (e.g. 'difference between TCP and UDP'): Grounding search cites the target domain (e.g. geeksforgeeks.org), but the LLM explains the concept directly without writing the brand name (100% Citation, 0% Mention).\n"
        "• Tool Recommendation Prompts (e.g. 'best free graphic design tools'): The LLM names the brand (Canva) #1 in its answer text, but grounding search cites 3rd-party review listicles rather than the brand's own domain (100% Mention, 0% Domain Citation).\n"
        "Conclusion: Tracking true GEO visibility requires categorizing queries into informational vs. commercial intent to understand where a brand is losing presence."
    )

    # 4. Codebase Technical Debt & Bottlenecks
    add_h1("4. Codebase Technical Debt & Architectural Bottlenecks")
    add_p(
        "An honest assessment of our current codebase reveals specific technical debt and architecture issues that must be refactored before scaling:"
    )

    add_h2("4.1 Heavy Application-Side Computing in /projects/{id}/summary")
    add_p(
        "Our summary endpoint (/projects/{id}/summary) currently loads every single execution record for a project from PostgreSQL into Python memory. "
        "The server then iterates over all executions in Python to compute visibility percentages, domain retrieval counts, citation rates, and sentiment distributions. "
        "While fast for 10 runs, this approach will degrade severely at 1,000+ executions. This computing must be shifted to SQL aggregation queries, database views, or pre-computed rollups."
    )

    add_h2("4.2 The N+1 Database Query Problem")
    add_p(
        "In our results endpoint, fetching a project's executions triggers chained lazy loading across multiple relationships: "
        "prompts, search_queries, web_search_results, brand_mentions, and execution_analyses. "
        "Instead of executing a single optimized query with SQL JOINs, the application executes 1 initial query + N queries for prompts + N queries for search results + N queries for mentions. "
        "This creates unnecessary database connection overhead and network roundtrips to Neon PostgreSQL."
    )

    add_h2("4.3 Monolithic Endpoints & Over-Fetching")
    add_p(
        "Several API endpoints currently return bloated payloads containing 10 different types of data at once. "
        "The system needs granular, purpose-built endpoints so the frontend only fetches the exact slice of data needed for the active view."
    )

    add_h2("4.4 Frontend Monolith (App.jsx) & Generic Routing")
    add_p(
        "Currently, App.jsx handles state management, API data fetching, modal toggles, polling, and view rendering in a single large file. It needs to be refactored into modular custom hooks and focused components. "
        "Furthermore, the application uses a generic /dashboard route for all views. Routing must be made project-specific (e.g., /dashboard/:projectId or /projects/:projectId) to allow bookmarking, deep-linking, and cleaner state synchronization."
    )

    # 5. What We Learned (SEO & GEO Insights)
    add_h1("5. What We Learned (SEO & GEO Insights)")
    add_p(
        "1. Traditional SEO vs. Generative Engine Optimization (GEO): Traditional SEO optimizes for Googlebot crawlers, keyword density, and blue link rankings (#1–#10). GEO optimizes for probabilistic LLM knowledge synthesis, entity relationships, and Share of Model (SoM).\n\n"
        "2. Zero-Click Search Defense: AI Overviews answer user questions directly on the search results page, leading to significant declines in organic website click-through rates. GEO is a defensive discipline: ensuring a brand is credited and recommended directly inside the synthesized AI answer itself.\n\n"
        "3. Entity Salience Over Keywords: Large language models do not match keywords; they retrieve entities based on vector proximity in knowledge graphs. A brand must have dense semantic association with its category across authoritative digital corpora to appear in non-branded queries.\n\n"
        "4. Information Gain and Quotability Win Citations: Search retrieval engines powering AI answers prioritize content with high fact density—such as structured comparison tables, verified statistics, and direct definitions—over generic marketing prose."
    )

    # 6. Future Implementation Plan & Technical Roadmap
    add_h1("6. Future Implementation Plan & Technical Roadmap")
    add_p("To evolve PromptPulse from a working POC into a production-grade monitoring platform, our engineering roadmap focuses on six key initiatives:")
    add_p(" Eliminate the N+1 query problem in backend/app/api/results.py by using SQLAlchemy joinedload and selectinload to fetch executions, prompts, and citations in a single database roundtrip.", bold_prefix="1. Database Optimization & Eager Loading:", bullet=True)
    add_p(" Implement Redis caching for project summary endpoints, citation audit tables, and API rate-limiting counters. Summary metrics will be updated via cached rollups rather than recomputed across all rows on every page load.", bold_prefix="2. Redis Caching Layer:", bullet=True)
    add_p(" Replace in-process ThreadPoolExecutor with Celery and Redis worker queues. This enables scheduled background batch runs (e.g. 500 prompts nightly per client) with token-bucket rate limiters.", bold_prefix="3. Distributed Worker Architecture (Celery + Redis):", bullet=True)
    add_p(" Complement Tavily search with a dedicated headless browser crawler (Playwright / Crawl4AI) capable of crawling 4 levels deep into client websites to index nested service pages and case studies.", bold_prefix="4. Deep Recursive Web Crawler:", bullet=True)
    add_p(" Split App.jsx into dedicated custom hooks (useProjects, useRuns, useBatchExecution) and implement React Router with project-specific URLs (/projects/:projectId).", bold_prefix="5. Frontend Modularization & RESTful Routing:", bullet=True)
    add_p(" Build a benchmarking engine that executes the same prompt suite concurrently across OpenAI GPT-4o Search, Google Gemini 1.5 Pro, Anthropic Claude 3.5, and Perplexity to generate cross-engine visibility comparisons.", bold_prefix="6. Multi-Model Benchmarking Matrix:", bullet=True)

    # Save documents
    output_path = r"d:\prompt-pulse\RankUno_POC_Discussion_Document.docx"
    doc.save(output_path)
    print(f"Saved clean document to: {output_path}")

    downloads_path = r"C:\Users\aadis\Downloads\RankUno_POC_Discussion_Document.docx"
    try:
        shutil.copyfile(output_path, downloads_path)
        print(f"Copied clean document to: {downloads_path}")
    except Exception as e:
        print(f"Could not copy to Downloads: {e}")

if __name__ == "__main__":
    create_document()
