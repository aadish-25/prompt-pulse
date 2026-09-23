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
- **Provider-agnostic LLM routing** — all calls go through [OpenRouter](https://openrouter.ai), letting you switch between GPT-4o, Gemini 2.5 Flash, Claude Haiku, and Llama 3.3 from the UI header without touching code.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React |
| **Backend** | FastAPI (Python), SQLAlchemy ORM |
| **Database** | PostgreSQL |
| **LLM Routing** | [OpenRouter](https://openrouter.ai) — `openai/gpt-4o-mini`, `openai/gpt-4o`, `google/gemini-2.5-flash`, `anthropic/claude-haiku-4.5`, `meta-llama/llama-3.3-70b-instruct` |
| **Web Search** | [Tavily Search API](https://tavily.com) |
| **Structured Outputs** | OpenAI `beta.chat.completions.parse` via OpenRouter |

---

## LLM Calls at a Glance

PromptPulse makes exactly **3 types of LLM calls** across the pipeline:

| # | Call | File | Method | Cost Driver |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Prompt Variant Generation** | `variants.py` | `beta.chat.completions.parse` | ~1,000 tokens per 10 prompts |
| 2 | **Search & Grounding Agent Loop** | `llm.py` | `chat.completions.create` + tool calls | ~25,000 tokens per prompt (accumulates across 5 turns) |
| 3 | **Competitor & Sentiment Extraction** | `extraction.py` | `beta.chat.completions.parse` | ~625 tokens per prompt |

> For a detailed per-turn token breakdown and cost matrix, see [`LLM_CALLS_AUDIT.md`](./LLM_CALLS_AUDIT.md).

---

## Known Limitations

- **Year injection in queries** — the model occasionally appends a year (e.g. "best shoes India 2024") to generated search queries despite the instruction to avoid it. This is a prompt-following limitation of smaller models.
- **Brand website citations are rare** — brand-owned sites (e.g. boat-lifestyle.com, mamaearth.in) are built for selling, not for answering comparison questions. They use banner images rather than crawlable text, so Tavily rarely extracts anything quotable from them. Review sites and aggregators get cited instead.
- **Tavily result quality for broad prompts** — Tavily's general-purpose crawler favours blog aggregators and minor retail sites over authoritative review outlets on some broad queries. Switching to provider-native grounding (OpenAI Responses API, Gemini Search) would improve this but sacrifices the provider-agnostic design.

---

## Environment Variables

Create a `.env` file in the project root (`d:/prompt-pulse/.env`):

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname

# OpenRouter API key (https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-...

# Tavily Search API key (https://app.tavily.com)
TAVILY_API_KEY=tvly-...
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