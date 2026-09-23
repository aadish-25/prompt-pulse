import shutil
import docx
from docx.shared import Inches, Pt, RGBColor

def create_document():
    doc = docx.Document()

    # Standard 1-inch Margins
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
        r.font.size = Pt(14)
        r.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = RGBColor(30, 41, 59)
        return p

    # Document Header
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_t = p_title.add_run("PromptPulse: POC Technical Review & Discussion")
    r_t.bold = True
    r_t.font.size = Pt(18)
    r_t.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    r_s = p_sub.add_run("Engineering Approach, System Architecture, Bottlenecks & SEO/GEO Insights")
    r_s.font.size = Pt(11)
    r_s.italic = True
    r_s.font.color.rgb = RGBColor(100, 116, 139)

    # 1. How We Approached the Problem
    add_h1("1. How We Approached the Problem")
    add_p("As user search habits transition from traditional search engines (ten blue links) to generative AI engines (ChatGPT Search, Perplexity, Google AI Overviews), brand visibility is no longer defined by SERP rank #1–10. Instead, visibility depends on whether an AI system mentions, recommends, compares, or cites a brand during response generation.")
    add_p("We built PromptPulse to evaluate and monitor brand presence inside AI-generated answers through an automated pipeline:")
    add_p(" We create non-branded consumer search queries (e.g., 'best free online graphic design tools' rather than 'Canva') to test how models respond to real consumer intent without brand bias.", bold_prefix="Brand-Agnostic Prompt Suites:", bullet=True)
    add_p(" An autonomous ReAct loop retrieves real-time web evidence via Tavily Search, synthesizes an answer, and maps factual claims to bracketed citation markers [X].", bold_prefix="Search-Grounded Inference:", bullet=True)
    add_p(" Mentions are detected deterministically using word-boundary regex with Levenshtein typo tolerance, combined with an LLM call to extract competitor presence and sentiment.", bold_prefix="Dual Extraction Pipeline:", bullet=True)
    add_p(" Executions, queries, cited domains, and metrics are stored relationally in PostgreSQL to track performance across execution batches.", bold_prefix="Relational Tracking:", bullet=True)

    # 2. Architecture
    add_h1("2. Current System Architecture")
    add_p("The system architecture connects four core layers into a streamlined execution pipeline:")
    add_p(" Built with React 19 and Tailwind CSS. Provides project management, prompt suite authoring, dynamic model selection (Groq open-source vs. OpenRouter), and batch execution monitoring.", bold_prefix="Frontend Layer:", bullet=True)
    add_p(" Built with FastAPI and Pydantic v2. Exposes REST endpoints to manage projects, generate prompt variants, trigger execution batches, and deliver aggregated analytics.", bold_prefix="Backend API Service:", bullet=True)
    add_p(" Coordinates live web retrieval through Tavily Search API, feeds context to LLMs (OpenRouter/Groq) for answer synthesis with source grounding, and parses citation manifests.", bold_prefix="AI & Grounding Engine:", bullet=True)
    add_p(" Serverless Neon PostgreSQL database storing normalized tables for projects, prompts, executions, web results, brand mentions, and sentiment analysis.", bold_prefix="Database Persistence:", bullet=True)

    # 3. Breaking Points & Bottlenecks Discovered
    add_h1("3. Breaking Points & Bottlenecks Discovered")
    add_p("During development and live testing, we identified key bottlenecks and constraints directly within what we built:")

    add_h2("Backend & Database Bottlenecks")
    add_p(" In the results endpoint, fetching executions lazily loaded related prompts, search queries, web results, and mentions in separate queries. On a serverless database, these repeated roundtrips create noticeable API latency.", bold_prefix="N+1 Query Overhead:", bullet=True)
    add_p(" The summary endpoint (/projects/{id}/summary) loads raw execution rows into Python memory and computes visibility rates and citation counts in application loops. While suitable for POC volumes, this calculation needs to be offloaded to database SQL aggregation (GROUP BY, COUNT) or pre-aggregated rollups.", bold_prefix="In-Memory Metric Calculation:", bullet=True)

    add_h2("AI Pipeline & Grounding Bottlenecks")
    add_p(" The initial design attempted to fan out 5 parallel worker threads per batch. However, because each worker chained Tavily search, synthesis LLM, and extraction LLM calls, 15+ concurrent requests overwhelmed free/shared API tiers and triggered HTTP 429 rate limit errors. We throttled execution down to a reliable sequential workflow (~45–60s per batch).", bold_prefix="Concurrency Collapse (Rate Limiting):", bullet=True)
    add_p(" Tavily operates as a top-snippet retrieval engine rather than a deep website crawler. For niche B2B domains, it often retrieves high-level directory aggregators and misses deep case studies or service pages nested 3–4 levels into the site.", bold_prefix="Snippet Retrieval vs. Deep Crawling:", bullet=True)

    add_h2("SEO/GEO Structural Discrepancy")
    add_p(" We discovered a frequent divergence between mentions and citations: conceptual queries ('what is X') often cite the brand's domain without explicitly naming the brand in the text, whereas recommendation queries ('best tools for Y') name the brand prominently but cite third-party review listicles rather than the brand's own URL.", bold_prefix="Mention vs. Citation Asymmetry:", bullet=True)

    # 4. What We Learned (SEO & GEO Insights)
    add_h1("4. What We Learned (SEO & GEO Insights)")
    add_p("Our live evaluations yielded four fundamental principles governing Generative Engine Optimization:")
    add_p(" Traditional SEO focuses on SERP ranking positions (#1–#10). GEO centers on Share of Model (SoM)—whether an LLM includes the brand in its synthesized response and how it is framed against competitors.", bold_prefix="Rankings vs. Share of Model:", bullet=True)
    add_p(" With AI Overviews answering search queries directly, organic click-through rates decline. Brand presence directly within the generated answer is the primary lever for maintaining discovery.", bold_prefix="Zero-Click Search Reality:", bullet=True)
    add_p(" LLMs retrieve entities based on semantic relationships and vector proximity in knowledge graphs rather than exact keyword density. Broad topical authority across trusted industry sources drives model recall.", bold_prefix="Entity Salience Over Keywords:", bullet=True)
    add_p(" Retrieval engines powering AI models preferentially cite content with high information gain—structured comparison tables, verified benchmarks, and concise definitions win citations over marketing fluff.", bold_prefix="Fact Density & Information Gain:", bullet=True)

    # 5. Future Plans
    add_h1("5. Future Implementation Plan")
    add_p("Based on the bottlenecks identified, our next development phase focuses on the following technical improvements:")
    add_p(" Eliminate N+1 query overhead using SQLAlchemy joinedload/selectinload and push summary statistics into SQL aggregations, backed by a Redis caching layer for sub-second dashboard loads.", bold_prefix="Database & Query Optimization:", bullet=True)
    add_p(" Replace synchronous in-process execution with Celery and Redis worker queues, incorporating token-bucket rate limiting to run large prompt batches reliably in the background.", bold_prefix="Asynchronous Worker Queue:", bullet=True)
    add_p(" Complement API snippet retrieval with a dedicated headless crawler (Playwright) capable of indexing deep, multi-level website content for technical brands.", bold_prefix="Deep Web Crawler Integration:", bullet=True)
    add_p(" Expand testing to run standardized prompt suites simultaneously across OpenAI, Google Gemini, and Perplexity to generate comparative cross-engine visibility benchmarks.", bold_prefix="Multi-Model Benchmarking Matrix:", bullet=True)

    # Save to local project and Downloads
    target_path = "RankUno_POC_Discussion_Document.docx"
    doc.save(target_path)
    print(f"Saved clean, precise document to: {target_path}")

    downloads_path = r"C:\Users\aadis\Downloads\RankUno_POC_Discussion_Document.docx"
    try:
        shutil.copyfile(target_path, downloads_path)
        print(f"Copied clean, precise document to: {downloads_path}")
    except Exception as e:
        print(f"Error copying to downloads: {e}")

if __name__ == "__main__":
    create_document()
