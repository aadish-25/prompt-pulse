import shutil
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_arch_box(doc, title, items, subtitle=""):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, "F8FAFC")
    set_cell_margins(cell, top=100, bottom=100, left=160, right=160)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:left w:val="single" w:sz="18" w:space="0" w:color="2563EB"/><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/></w:tcBorders>')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    r_title = p.add_run(title)
    r_title.bold = True
    r_title.font.size = Pt(10.5)
    r_title.font.color.rgb = RGBColor(15, 23, 42)
    
    if subtitle:
        r_sub = p.add_run(f"  •  {subtitle}")
        r_sub.font.size = Pt(9)
        r_sub.font.color.rgb = RGBColor(100, 116, 139)
        
    for item in items:
        p_item = cell.add_paragraph()
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(1)
        r_bullet = p_item.add_run("▸ ")
        r_bullet.font.color.rgb = RGBColor(37, 99, 235)
        r_bullet.bold = True
        r_txt = p_item.add_run(item)
        r_txt.font.size = Pt(9.5)
        r_txt.font.color.rgb = RGBColor(51, 65, 85)

def add_arrow(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("▼")
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor(148, 163, 184)

def build_compact_document():
    doc = docx.Document()

    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)

    # Document Header
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(1)
    r_t = p_title.add_run("PromptPulse: GEO & AI Brand Visibility Tracker")
    r_t.bold = True
    r_t.font.size = Pt(18)
    r_t.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    r_s = p_sub.add_run("POC Approach, Architecture, Breaking Points, Bottlenecks & SEO/GEO Learnings")
    r_s.font.size = Pt(11)
    r_s.font.color.rgb = RGBColor(71, 85, 105)

    # 1. How We Approached the Problem
    h1 = doc.add_heading("1. How We Approached the Problem", level=1)
    h1.style.font.color.rgb = RGBColor(15, 23, 42)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.add_run(
        "Search behavior is fundamentally shifting from traditional search engines (ten blue links) to generative answer engines "
        "(ChatGPT Search, Perplexity, Google AI Overviews, Gemini). Traditional SEO tools measure keyword ranks and backlink counts, "
        "leaving digital marketers blind to whether an AI actually recommends, critiques, or cites their brand."
    )
    p2 = doc.add_paragraph()
    p2.paragraph_format.space_after = Pt(6)
    p2.add_run(
        "We selected Problem Statement A (GEO Prompt & Brand Visibility Tracker) and approached it through an end-to-end 4-step workflow:\n"
        "1. Brand-Agnostic Prompt Suites: Designed prompts that reflect natural, non-branded consumer queries (e.g., 'best free online graphic design tools').\n"
        "2. Grounded Multi-Step AI Agent: Implemented an autonomous ReAct loop where the LLM queries Tavily Web Search, reviews live results, and writes synthesized answers with inline bracket citations [X].\n"
        "3. Hybrid Verification Engine: Combined deterministic regex with Levenshtein fuzzy matching (>= 0.82) to eliminate hallucinated brand mentions, followed by structured Pydantic LLM extraction for competitor discovery and sentiment.\n"
        "4. Versioned Batch Tracking: Implemented chronological batch execution and relational persistence to observe visibility changes over time."
    )

    # 2. System Architecture
    h1 = doc.add_heading("2. System Architecture", level=1)
    h1.style.font.color.rgb = RGBColor(15, 23, 42)

    add_arch_box(doc, "Frontend Layer (React 19 + Vite + Tailwind CSS)", [
        "Prompt suite creation, project switcher, and dynamic model selector (Groq / OpenRouter)",
        "Batch-first view with rectangular badge identifiers and fixed-width tables (zero scrollbars)",
        "Optimistic state updates: instant 0ms UI deletion with background API synchronization"
    ])
    add_arrow(doc)
    add_arch_box(doc, "Application & API Layer (FastAPI + Pydantic v2)", [
        "REST endpoints (/projects, /prompts, /runs, /results) enforcing strict data contracts",
        "Orchestration service coordinating prompt runs and batch executions"
    ])
    add_arrow(doc)
    add_arch_box(doc, "Execution & Grounding Layer (Tavily Search + Multi-LLM)", [
        "ReAct agent loop triggering Tavily Web Search for real-time fact retrieval",
        "Dual-provider LLM support: Groq (ultra-fast inference) and OpenRouter (frontier models)",
        "Automated citation formatter enforcing inline [X] markers and closing 'CITED: 1, 2' manifests"
    ])
    add_arrow(doc)
    add_arch_box(doc, "Hybrid Extraction Layer (Deterministic + Structured LLM)", [
        "Deterministic matcher: Regex word boundaries (\\bbrand\\b) + typo distance ratio (0.82)",
        "Structured extractor: Pydantic schemas parsing competitor lists, sentiment, and remarks"
    ])
    add_arrow(doc)
    add_arch_box(doc, "Persistence Layer (Neon Serverless PostgreSQL)", [
        "Normalized relational models: projects, prompts, prompt_executions, web_search_results, brand_mentions, and execution_analyses"
    ])

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # 3. Plans & Future Pathway
    h1 = doc.add_heading("3. Plans & Future Pathway", level=1)
    h1.style.font.color.rgb = RGBColor(15, 23, 42)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.add_run(
        "• Distributed Background Workers (Celery + Redis): Transition from in-process thread pooling to a robust distributed task queue to handle scheduled client monitoring suites (1,000+ prompts nightly).\n"
        "• Deep Recursive Crawler (Playwright / Crawl4AI): Pair Tavily search with a dedicated headless crawler capable of traversing client sites 4 to 5 levels deep to map internal links and nested blog hierarchies.\n"
        "• Cross-Model Benchmarking Matrix: Concurrently execute prompt suites across OpenAI GPT-4o Search, Google Gemini 1.5 Pro, and Perplexity Sonar to track cross-engine visibility discrepancies.\n"
        "• Automated Remediation Agent: Automatically generate actionable content briefs when a brand has 0% mentions on high-intent queries, recommending what data tables and statistics to publish to win citations."
    )

    # 4. Breaking Points & Bottlenecks Discovered
    h1 = doc.add_heading("4. Breaking Points & Bottlenecks Discovered", level=1)
    h1.style.font.color.rgb = RGBColor(15, 23, 42)

    doc.add_heading("4.1 Free-Tier Token Limits & Quota Exhaustion", level=2)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.add_run(
        "A single prompt run consumes 3,000 to 4,500 tokens across system instructions, injected search snippets, synthesized answers, and structured extraction. "
        "On free-tier API endpoints (OpenRouter/Groq), executing batches of 5 to 10 prompts rapidly exhausted tokens and triggered HTTP 429 (Rate Limit Exceeded) errors. "
        "We mitigated this using tenacity exponential backoff retries and dynamic switching to Groq's high-throughput open-source models."
    )

    doc.add_heading("4.2 Concurrency Collapse: 5-Worker Fan-Out vs. Sequential Fallback", level=2)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.add_run(
        "Our original plan was to fan out 5 parallel worker threads via ThreadPoolExecutor so a 5-prompt batch would finish in ~10 seconds. "
        "However, because each worker chains multiple API calls (Tavily search + ReAct LLM + extraction LLM), 5 parallel workers generated 15+ concurrent requests simultaneously. "
        "This spiked API rate limits and caused socket failures. To ensure rock-solid stability, we defensively throttled concurrency down to sequential/serialized execution, "
        "eliminating crashes but increasing batch run duration to ~45–60 seconds."
    )

    doc.add_heading("4.3 Tavily Crawling Depth Limits", level=2)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.add_run(
        "Tavily functions as an indexed snippet retrieval tool rather than a recursive crawler. "
        "For niche B2B or agency domains, key case studies and technical articles are often nested 3 or 4 levels deep in the URL hierarchy. "
        "Tavily frequently misses these deep sub-pages and instead returns generic high-level directory aggregators. "
        "Toggling search_depth to 'advanced' increased snippet length but did not resolve the crawl depth limitation."
    )

    doc.add_heading("4.4 The Mention vs. Citation Asymmetry Problem", level=2)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.add_run(
        "Empirical testing revealed a core divergence in generative AI behavior:\n"
        "• Citations with 0 Mentions: Conceptual prompts ('difference between TCP and UDP') retrieve the domain in grounding citations, but the LLM explains the concept directly without writing the brand name.\n"
        "• Mentions with 0 Citations: Tool queries ('best online graphic design tools') prompt the LLM to recommend the brand (Canva) #1 in the text, but the search engine cites 3rd-party review listicles rather than the brand's own domain.\n"
        "Insight: True GEO visibility requires designing queries with commercial or problem-solving intent where both brand authority and domain utility are cited together."
    )

    doc.add_heading("4.5 Cumulative Latency & Database Cascade Locking", level=2)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.add_run(
        "Chaining tool calls, search grounding, and secondary extraction produces an end-to-end latency of 6 to 12 seconds per prompt. "
        "Furthermore, deleting executions initially caused UI freezes due to cascading foreign-key deletions across 5 database tables. "
        "We eliminated this by removing confirmation popups and implementing Optimistic Deletion in React (instant 0ms card removal with background synchronization)."
    )

    # 5. What We Learned (SEO & GEO Insights)
    h1 = doc.add_heading("5. What We Learned (SEO & GEO Insights)", level=1)
    h1.style.font.color.rgb = RGBColor(15, 23, 42)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.add_run(
        "1. Traditional SEO vs. GEO: Traditional SEO optimizes for deterministic Googlebot crawlers, keyword density, and blue link rankings (#1–#10). "
        "GEO optimizes for probabilistic LLM knowledge synthesis, entity relationships, and Share of Model (SoM).\n\n"
        "2. Zero-Click Search Defense: AI Overviews answer user questions directly on the SERP, leading to steep drops in organic website clicks. "
        "GEO ensures a brand protects its market presence by being featured and favorably credited directly inside the synthesized AI response.\n\n"
        "3. Entity Salience Over Keyword Stuffing: Large language models retrieve brands based on vector proximity in knowledge graphs. "
        "A brand must have dense semantic co-occurrence with its problem domain across authoritative third-party sources to be recommended for non-branded queries.\n\n"
        "4. Information Gain Wins Citations: Retrieval engines powering AI search prioritize content with high fact density—such as structured comparison tables, "
        "verified numerical data, and direct technical definitions—over subjective marketing prose."
    )

    # Output paths
    output_path = r"d:\prompt-pulse\RankUno_POC_Discussion_Document.docx"
    doc.save(output_path)
    print(f"Successfully saved compact document to: {output_path}")

    downloads_path = r"C:\Users\aadis\Downloads\RankUno_POC_Discussion_Document.docx"
    try:
        shutil.copyfile(output_path, downloads_path)
        print(f"Successfully copied compact document to Downloads: {downloads_path}")
    except Exception as e:
        print(f"Could not copy to Downloads: {e}")

if __name__ == "__main__":
    build_compact_document()
