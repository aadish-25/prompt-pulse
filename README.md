# PromptPulse

> **Track your brand's visibility inside AI-generated answers — before your competitors do.**

PromptPulse is an AI visibility monitoring platform that tells you exactly how, when, and how positively large language models mention your brand when real customers ask questions. You define your brand and a set of consumer search queries. PromptPulse runs them through an LLM-powered research agent that searches the web, synthesises grounded answers, and extracts brand mentions, competitor co-mentions, citation sources, and sentiment — all stored, trended, and presented in a clean dashboard.

---

## Why It Exists

Search is shifting. Consumers increasingly ask AI assistants — "which laptop is best for students under ₹50,000?" or "what's a good wireless earphone under ₹3,000?" — instead of clicking through ten blue links. Traditional SEO tools have no visibility into this new discovery channel.

PromptPulse was built to answer three questions:

1. **Is my brand even showing up** in AI answers for queries my customers actually ask?
2. **Which competitors are being recommended** instead?
3. **Is the sentiment positive, neutral, or negative** when my brand is mentioned?

---

## How It Works — Full Workflow

```
User defines a Project (brand name, domain, competitors, aliases)
        │
        ▼
[ AI Prompt Creator ]
  ↳ LLM generates 10 brand-agnostic consumer search queries
    (e.g. "best wireless earbuds under 2000 for gym use")
  ↳ User reviews, selects, and can add custom prompts
        │
        ▼
[ Batch Execution Engine ]
  ↳ For each selected prompt, a ReAct-style agent loop runs:
      Turn 1 → LLM decides what to search
      Turn 2 → Web search via Tavily → 10 results injected
      Turn 3 → LLM searches again (minimum 3 searches enforced)
      Turn 4 → Third web search injected
      Turn 5 → LLM writes final grounded answer with [X] citations
  ↳ Executions run sequentially (CONCURRENT_WORKERS = 1)
        │
        ▼
[ Brand & Sentiment Extraction ]
  ↳ Regex + fuzzy matching finds target brand mentions (typo-tolerant)
  ↳ LLM structured-output call extracts: competitor list, sentiment, remark
  ↳ Citation source URLs correlated with cited [X] markers
        │
        ▼
[ Dashboard ]
  ↳ AI Answers & Grounding: Full LLM answers, citations, brand analysis per prompt
  ↳ Historical runs with pass/fail status, timestamps, error details
  ↳ Competitor co-mention tracking across all executions
```

### Key Design Decisions

- **Grounded answers only** — the agent is forced to call `web_search` at least 3 times before producing any answer. No hallucinated recall.
- **Brand-agnostic prompts** — the variant generator never names your brand or competitors in the queries. Queries reflect how a real, uninformed consumer would search.
- **Fuzzy brand matching** — `difflib.SequenceMatcher` with a 0.82 threshold catches single-character typos (e.g. "Lenevo" → "Lenovo") in both mention detection and competitor filtering.
- **Citation tracing** — every cited source `[X]` in the answer is matched back to the exact Tavily result URL and stored in the database.
- **Dynamic multi-provider LLM routing** — PromptPulse seamlessly routes requests across **OpenRouter (`OR:`)**, **Groq (`GROQ:`)**, **AgentRouter (`AR:`)**, and **DeepSeek (`DS:`)** using standard OpenAI-compatible client semantics. Select any model from the top navigation dropdown without modifying code.

---

## Supported Models & Providers

PromptPulse includes a curated multi-provider model pool accessible directly via the top navbar dropdown:

| Prefix | Provider | Model ID in UI | Upstream Model Name | Best For / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `OR:` | **OpenRouter** | `OR: openai/gpt-4o-mini` | `openai/gpt-4o-mini` | Fast, cost-effective default for generation and evaluation |
| `OR:` | **OpenRouter** | `OR: google/gemini-2.5-flash` | `google/gemini-2.5-flash` | High-quality reasoning, strong grounding & long-context synthesis |
| `OR:` | **OpenRouter** | `OR: meta-llama/llama-3.3-70b-instruct` | `meta-llama/llama-3.3-70b-instruct` | Open-weights leader with strong instruction-following capabilities |
| `OR:` | **OpenRouter** | `OR: openai/gpt-4o` | `openai/gpt-4o` | Flagship OpenAI frontier model for mission-critical benchmark runs |
| `GROQ:` | **Groq** | `GROQ: openai/gpt-oss-120b` | `openai/gpt-oss-120b` | Ultra-fast LPU inference, native tool calling & structured outputs |
| `GROQ:` | **Groq** | `GROQ: qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | Blazing-fast inference for rapid prompt variant ideation |
| `GROQ:` | **Groq** | `GROQ: openai/gpt-oss-20b` | `openai/gpt-oss-20b` | Extremely lightweight, low-latency testing |
| `AR:` | **AgentRouter** | `AR: gpt-4o-mini` | `gpt-4o-mini` | Balanced intelligence using AgentRouter community credit pool |
| `AR:` | **AgentRouter** | `AR: gpt-4o` | `gpt-4o` | Frontier OpenAI model routed through AgentRouter |
| `AR:` | **AgentRouter** | `AR: claude-3-5-sonnet` | `claude-3-5-sonnet` | Anthropic's top-tier reasoning and coding model (avoids overkill of Opus) |
| `AR:` | **AgentRouter** | `AR: gemini-1.5-flash` | `gemini-1.5-flash` | Fast Google model on AgentRouter |
| `AR:` | **AgentRouter** | `AR: deepseek-chat` | `deepseek-chat` | DeepSeek-V3 chat via AgentRouter |
| `DS:` | **DeepSeek** | `DS: deepseek-chat` | `deepseek-chat` | Direct DeepSeek API (~$0.14/1M tokens, ultra-affordable) |
| `DS:` | **DeepSeek** | `DS: deepseek-reasoner` | `deepseek-reasoner` | Direct DeepSeek-R1 reasoning model for deep evaluation analysis |

### Other Available Models (Ready to Wire Up)

Because all four providers use standard OpenAI-compatible endpoints, you can add any of the following models simply by adding them to `SUPPORTED_MODELS` in `backend/app/config.py`:

* **Anthropic via OpenRouter / AgentRouter**:
  * `OR: anthropic/claude-3.5-haiku` / `AR: claude-3-5-haiku` (Affordable, ultra-fast Claude model)
  * `OR: anthropic/claude-3.7-sonnet` (Hybrid reasoning & thinking mode)
* **Meta Llama Family**:
  * `OR: meta-llama/llama-3.1-8b-instruct` / `GROQ: llama-3.1-8b-instant` (Very lightweight)
  * `OR: meta-llama/llama-3.1-405b-instruct` (Massive open-weights foundation model)
* **Qwen & Mistral Family**:
  * `OR: qwen/qwen-2.5-72b-instruct` (Top multilingual benchmark performer)
  * `OR: mistralai/mistral-large-2411` (Mistral's flagship enterprise model)
* **Google Gemini Direct**:
  * `OR: google/gemini-2.0-flash-exp` (Next-gen Gemini 2.0 experimental reasoning)
  * `AR: gemini-1.5-pro` (Long-context 2M token analysis)

To add any new model, simply append `"PREFIX: actual-model-id"` into `SUPPORTED_MODELS` in `backend/app/config.py`.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# PostgreSQL connection string (Neon, Supabase, or local PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Tavily Web Search API key (https://app.tavily.com)
TAVILY_API_KEY=tvly-...

# --- Provider API Keys (Set whichever you want to use) ---
OPENROUTER_API_KEY=sk-or-v1-...
GROQ_API_KEY=gsk_...
AGENTROUTER_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...

# Optional Custom Gateway overrides
# LLM_BASE_URL=https://gateway.ai.cloudflare.com/v1/...
# LLM_API_KEY=sk-...
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (running locally or a hosted instance)

### 1. Clone & install

```bash
git clone https://github.com/your-username/prompt-pulse.git
cd prompt-pulse
```

### 2. Backend setup

```bash
# Create a virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv openai tavily-python
```

### 3. Configure environment

```bash
# Copy and fill in your keys
cp .env.example .env
# Edit .env with your DATABASE_URL, OPENROUTER_API_KEY, TAVILY_API_KEY
```

### 4. Start the backend

```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```

The API will be live at `http://localhost:8000`. Test it:

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

### 5. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The React app will be at `http://localhost:5173`. All `/api/*` requests are proxied to `http://localhost:8000` via Vite's dev proxy (configured in [`vite.config.js`](./frontend/vite.config.js)).

---


## Configuration Reference

All runtime configuration lives in [`backend/app/config.py`](./backend/app/config.py):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MODEL` | `openai/gpt-4o-mini` | Default LLM model for the grounding agent and extraction |
| `SUPPORTED_MODELS` | *(list of 5)* | Models available in the UI dropdown |
| `ROUNDS` | `1` | How many execution rounds per batch |
| `MAX_SEARCH_STEPS` | `5` | Maximum tool-call turns per prompt in the agent loop |
| `FORCE_MIN_SEARCHES` | `True` | Enforces at least `MIN_SEARCHES` web searches before the final answer |
| `MIN_SEARCHES` | `3` | Minimum forced web searches per prompt |
| `CONCURRENT_WORKERS` | `1` | Number of parallel prompt executions (keep at 1 to avoid OpenRouter in-flight credit exhaustion) |
| `DEFAULT_VARIANT_COUNT` | `5` | Default number of prompt variants to generate |
| `MAX_VARIANT_COUNT` | `10` | Maximum prompt variants per generation |

---

## API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check |
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a new project |
| `DELETE` | `/api/projects/{id}` | Delete a project |
| `GET` | `/api/projects/{id}/prompts` | Get all prompts for a project |
| `POST` | `/api/projects/{id}/prompts` | Add a prompt to a project |
| `POST` | `/api/projects/{id}/prompts/generate-variants` | Generate AI prompt variants |
| `POST` | `/api/projects/{id}/batches` | Start a batch execution run |
| `GET` | `/api/projects/{id}/results` | Get all execution results |
| `DELETE` | `/api/projects/{id}/results` | Clear all results for a project |

---

## Future Scope & Architectural Roadmap

Studying open-source GEO systems (**Canonry**, **Elmo**, **GEO/AEO Tracker**) highlights several high-impact capabilities slated for future database schema expansions:

### 1. Intent-Categorized Prompts in PostgreSQL
* **Current**: The `prompts` table stores `(id, project_id, text, active, created_at)`. Intent buckets (`core_need`, `criteria`, `competitor`, `persona`, `transaction`) are generated and displayed on candidate cards in the UI.
* **Roadmap**: Add an `intent_category: Mapped[str]` column to the `prompts` table so selected prompts retain their classification permanently in the tracking queue.

### 2. Segmented Intent Visibility Analytics
* **Current**: Brand visibility is computed as an aggregate percentage across all prompt runs in a project.
* **Roadmap**: Calculate visibility and sentiment broken down by intent bucket (e.g. *"85% visibility on Core Need queries, but only 20% visibility on Competitor Conquest queries"*), exposing exactly where competitors are displacing your brand in AI answers.

### 3. Persistent Brand ICP & Category Context
* **Current**: Brands define name, domain, competitors, and aliases.
* **Roadmap**: Add `icp_description` and `seed_topic` columns to the `projects` table so niche, early-stage, or ambiguous startups (e.g. *"Sprint"*, *"Orbit"*) maintain permanent category anchoring across all variant generations and evaluation runs without manual re-entry.

### 4. Search Trigger & Retrieval Fan-Out Tracking
* **Roadmap**: Track whether source-seeking triggers (*"based on reviews"*, *"what do developers recommend on reddit"*, *"with pros and cons"*) cause answer engines to expand search queries (fan-out) versus answering from internal parametric memory.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push and open a pull request

---

## License

MIT