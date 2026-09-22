# PromptPulse — End-to-End LLM Call & Token Pipeline Audit

This document details every single LLM call across the PromptPulse platform, what data is passed into them, how tokens accumulate across multi-turn agent loops, and cost evaluation benchmarks.

---

## 1. Executive Summary & Architecture Map

PromptPulse makes LLM calls in three distinct stages:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PROMPT VARIANT GENERATION (On-Demand)                                    │
│    POST /api/projects/{id}/prompts/generate-variants                        │
│    Generates 10 brand-agnostic consumer search queries                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. SEARCH & GROUNDING AGENT LOOP (Batch Execution)                          │
│    POST /api/projects/{id}/batches                                          │
│    Multi-turn ReAct loop: Web search + citation synthesis                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. BRAND & SENTIMENT EXTRACTION (Post-Execution Analysis)                   │
│    Extracts competitor brands and evaluates target sentiment                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Exhaustive Audit of All LLM Calls

### CALL 1: Brand-Aware Prompt Variant Generator

* **Source File**: [`backend/app/services/variants.py`](file:///d:/prompt-pulse/backend/app/services/variants.py) (`generate_prompt_variants`)
* **API Call**: `client.beta.chat.completions.parse(...)` (Structured Outputs via OpenRouter)
* **Model**: Dynamically specified by the user in the UI dropdown (`openai/gpt-4o-mini`, `openai/gpt-4o`, `google/gemini-2.5-flash`, etc.).
* **Frequency**: Triggered manually when the user clicks **"Generate 10 New Prompts"** in the AI Prompt Creator tab.
* **Volume**: Exactly **1 LLM call** per batch of 10 prompt candidates.

#### Content Sent (Prompt Structure)
1. **System Message** (`role: "system"`):
   - Injected Context:
     - Target Brand Name: `{brand_name}`
     - Brand Domains: `{domains}`
     - Known Competitors: `{competitors}`
     - Aliases: `{aliases}`
     - Target Count: `{count}`
   - Instructions:
     - **Step 1 (Internal Category Reasoning)**: Identifies the exact industry (tech, food, IT services, cosmetics) and 4–5 consumer decision criteria.
     - **Step 2 (Distribution Buckets)**: Core needs, quality criteria, alternative comparisons, specific user personas, and realistic Indian rupee budget framing (capped at 20–25% of prompts).
     - **Negative Rules**: Strict zero-mention of target brand, aliases, or competitor names.
   - Size: **~350 – 450 tokens**.
2. **User Message** (`role: "user"`):
   - `"Generate {bounded_count} authentic discovery and evaluation search prompts that real potential customers or decision-makers would search in the domain of {brand_name}."`
   - Size: **~25 tokens**.
3. **Structured Response Schema**:
   - `VariantGenerationResponse`:
     ```json
     {
       "variants": [
         {
           "text": "string (the actual prompt)",
           "intent_category": "string (e.g. Budget, Gaming, Work)",
           "rationale": "string (why a consumer searches this)"
         }
       ]
     }
     ```
   - Completion Output Size: **~350 – 600 tokens**.

#### Token Breakdown (Per Generation)
| Component | Tokens |
| :--- | :--- |
| System Prompt & Context | ~400 tokens |
| User Directive | ~25 tokens |
| Completion Output (10 Prompts + Rationales) | ~500 tokens |
| **Total per Generation Call** | **~900 – 1,000 tokens** |

---

### CALL 2: Search & Grounding Agent Loop (`run_prompt`)

* **Source File**: [`backend/app/services/llm.py`](file:///d:/prompt-pulse/backend/app/services/llm.py) (`run_prompt`)
* **API Call**: `client.chat.completions.create(...)` with Function/Tool Calling
* **Model**: Dynamically selected in Header (`selectedModel`).
* **Frequency**: Runs for **every prompt in the project** $\times$ number of rounds configured.
  - *Example*: 5 active prompts $\times$ 1 round = 5 prompt executions.
* **Execution Pattern**: Sequential execution (`CONCURRENT_WORKERS = 1` in `config.py`).

#### The Multi-Turn ReAct Loop Mechanics
The agent loop runs up to `MAX_STEPS + 1` iterations (max 6 turns). Because `FORCE_MIN_SEARCHES = True` and `MIN_SEARCHES = 3`, the agent is enforced to call `web_search` at least 3 times before generating the final answer.

#### Content Sent Per Turn

##### Turn 1 — Initial Intent & Search Decision
* **System Prompt**:
  ```text
  Date: {Current Date}. Answer using web search. 
  After every factual claim from a search result, append its reference number in brackets, e.g. [2]. 
  Use only [X] brackets. At the very end, append one line: 'CITED: 1, 2' listing all cited source numbers.
  ```
  *(~50 tokens)*
* **User Message**: The tracked consumer search query (e.g. *"which laptops have the best battery life under ₹50,000?"*). *(~15 – 30 tokens)*
* **Tools Definition**: Tool `web_search(query: string)` schema. *(~50 tokens)*
* **LLM Output**: Generates tool call `web_search(query="best battery life laptops under 50000 2026")`. *(~30 tokens)*
* **Cumulative Context**: **~150 tokens**.

##### Turn 2 — After Search #1
* **Tool Result Injected**:
  - Tavily fetches 10 results.
  - Injected as `role: "tool"`:
    ```text
    [1] Acer Aspire 3 Review
    URL: https://...
    {Raw snippet content}

    [2] Best Budget Laptops 2026
    URL: https://...
    {Raw snippet content}
    ... (10 total results)
    ```
  - Size of 10 search snippets: **~2,000 – 2,500 tokens**.
* **LLM Output**: Evaluates results, generates tool call `web_search(query="lenovo asus battery test comparison under 50k")`. *(~30 tokens)*
* **Cumulative Context**: **~2,700 tokens**.

##### Turn 3 — After Search #2
* **Tool Result Injected**: Another 10 search results injected into history.
* **LLM Output**: Generates tool call `web_search(query="laptops battery hours benchmarks")`. *(~30 tokens)*
* **Cumulative Context**: **~5,200 tokens**.

##### Turn 4 — After Search #3
* **Tool Result Injected**: Another 10 search results injected into history.
* **Cumulative Context**: **~7,700 tokens**.

##### Turn 5 — Final Answer Synthesis
* **User Directive Appended**:
  ```text
  Searching is finished. Write your final answer now, using only the sources you already have.
  ```
  *(tool_choice is set to "none")*
* **Cumulative Context Sent to LLM**: **~8,000 – 10,000 tokens**.
* **LLM Output**: Comprehensive comparative recommendation citing sources with `[1]`, `[4]` and ending with `CITED: 1, 4, 7`.
* **Completion Output Tokens**: **~500 – 900 tokens**.

#### Cumulative Token Consumption for ONE Prompt Run
Because OpenAI and OpenRouter bill **input tokens on every turn of a conversation**, the multi-turn context accumulates:

| Turn | Input Context | Output Generated |
| :--- | :--- | :--- |
| Turn 1 (Query) | ~150 tokens | ~30 tokens (Tool Call 1) |
| Turn 2 (Search 1) | ~2,700 tokens | ~30 tokens (Tool Call 2) |
| Turn 3 (Search 2) | ~5,200 tokens | ~30 tokens (Tool Call 3) |
| Turn 4 (Search 3) | ~7,700 tokens | ~30 tokens (Tool Call 4) |
| Turn 5 (Final Answer) | ~8,500 tokens | ~700 tokens (Final Answer) |
| **Sum Across Single Prompt Run** | **~24,250 Input Tokens** | **~820 Output Tokens** |

> [!IMPORTANT]
> **Why OpenRouter's Pre-Flight Reserve Triggered the 402 Error**:
> When running with multiple parallel workers without an explicit output cap, OpenRouter multiplied `workers × 16,384 tokens` for the in-flight reserve. With `CONCURRENT_WORKERS = 1`, requests run sequentially, meaning each prompt is billed turn-by-turn within its own isolated in-flight allocation.

---

### CALL 3: Competitor Extraction & Sentiment Analysis (`analyze_answer`)

* **Source File**: [`backend/app/services/extraction.py`](file:///d:/prompt-pulse/backend/app/services/extraction.py) (`analyze_answer`)
* **API Call**: `client.beta.chat.completions.parse(...)` (Structured Outputs via OpenRouter)
* **Model**: Fixed to `app.config.MODEL` (`openai/gpt-4o-mini`).
* **Frequency**: Triggered automatically **1 time immediately after each prompt execution** finishes.
* **Volume**: Exactly 1 call per completed prompt run.

#### Content Sent (Prompt Structure)
1. **System Message** (`role: "system"`):
   ```text
   Analyze this product answer for brand {target_brand}.
   1. List all OTHER competitor brands mentioned (exclude {target_brand} and typos of it).
   2. Judge sentiment toward {target_brand}: positive, neutral, negative, or not_mentioned.
   3. One concise sentence remark explaining the judgment.
   ```
   *(~55 tokens)*
2. **User Message** (`role: "user"`):
   - The synthesized AI answer produced in Call 2.
   - Size: **~400 – 800 tokens**.
3. **Structured Response Schema**:
   - `ExtractionResult`:
     ```json
     {
       "other_brands": ["Acer", "Asus", "HP"],
       "target_sentiment": "positive",
       "target_remark": "Lenovo was praised for 8-hour battery longevity and build."
     }
     ```
   - Completion Output Size: **~50 – 100 tokens**.

#### Token Breakdown (Per Extraction Call)
| Component | Tokens |
| :--- | :--- |
| System Instructions | ~55 tokens |
| AI Answer (User Context) | ~500 tokens |
| Structured Output JSON | ~70 tokens |
| **Total per Extraction Call** | **~625 tokens** |

---

## 3. What Does NOT Use LLM Tokens (Free/Local Logic)

To prevent duplicate LLM expenditures, several analytical steps run purely locally via Python:

1. **Target Brand Text Extraction** ([`find_target_mentions`](file:///d:/prompt-pulse/backend/app/services/extraction.py)):
   - Evaluates whether the target brand was mentioned in the response.
   - Uses exact word-boundary regex (`\bBrand\b`) + `difflib.SequenceMatcher` fuzzy typo matching.
   - **Cost**: 0 LLM tokens (runs in ~0.5ms locally).
2. **Citation Source Matching** ([`extract_cited`](file:///d:/prompt-pulse/backend/app/services/citations.py)):
   - Parses the `CITED: 1, 2` trailer line and inline `[X]` citation markers using regex.
   - Correlates cited indexes directly with `web_search_results` in the DB.
   - **Cost**: 0 LLM tokens.
3. **Web Search Queries**:
   - Executed via Tavily REST API (`search.py`).
   - **Cost**: Consumes Tavily search credits, not OpenRouter LLM tokens.

---

## 4. Total Pipeline Token Cost Matrix

### Scenario A: Running 1 Prompt (1 Round)
| Step | Input Tokens | Output Tokens | Total Tokens |
| :--- | :--- | :--- | :--- |
| Agent Search Loop (3 searches + final answer) | ~24,250 | ~820 | ~25,070 |
| Competitor Extraction & Sentiment | ~550 | ~70 | ~620 |
| **Total per 1 Prompt Evaluated** | **~24,800** | **~890** | **~25,690** |

### Scenario B: Standard Batch (5 Active Prompts, 1 Round)
| Step | Count | Est. Total Tokens |
| :--- | :--- | :--- |
| Agent Search Loops | 5 executions | ~125,350 tokens |
| Competitor Extraction Calls | 5 calls | ~3,100 tokens |
| **Total for Batch (5 Prompts)** | **10 LLM calls** | **~128,450 tokens** |

---

## 5. Summary Cheat Sheet for Future Evaluations

| Feature Area | File Location | OpenRouter Method | Primary Token Cost Driver |
| :--- | :--- | :--- | :--- |
| **AI Prompt Creator** | `backend/app/services/variants.py` | `beta.chat.completions.parse` | Fixed cost (~1,000 tokens per 10 prompts). |
| **Grounding Agent** | `backend/app/services/llm.py` | `chat.completions.create` | Cumulative search snippet history across 3-5 tool turns (~25k tokens per prompt). |
| **Brand Analysis** | `backend/app/services/extraction.py` | `beta.chat.completions.parse` | Proportional to answer length (~600 tokens per prompt). |
