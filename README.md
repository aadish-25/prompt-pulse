# PromptPulse

PromptPulse is an AI visibility monitoring workspace. It runs customer-style prompts through selected AI engines, stores their answers and source evidence, and analyses brand mentions, sentiment, competitor mentions and citation visibility.

## What it does

1. Create a project for a brand: name, website domains, aliases, competitors and brand context.
2. Add prompts manually, in bulk, or generate candidate ideas.
3. Run prompts across selected AI engines and inspect each execution.
4. Review brand visibility, target sentiment, competitor mentions and cited/retrieved sources.
5. Compare domain performance and competitor mention share across completed runs.

## Main workspace pages

- **Overview:** visibility rate, completed-run count, top cited domains, recent tracking activity and competitor mentions.
- **Prompt Library:** search, add one or multiple prompts, edit, activate/pause and paginate.
- **Tracking:** start tracking cycles and filter executions by status, batch, round and date.
- **Run Analysis:** inspect a selected prompt's final answer, target sentiment, brand remark, matched mentions, competitors, sources and search queries.
- **Sources & Citations:** domain ranking and individual observed sources, with configured brand domains highlighted.
- **Competitors:** ranked competitor mention counts and share of all competitor mentions.
- **Project Settings:** project brand identity/context, selected engines, tracking cadence preferences and project deletion.
- **My Profile:** username, email, profile image, password and provider API keys.

## Providers and supported models

The provider prefix selects the corresponding OpenAI-compatible endpoint:

| Prefix | Provider | Supported model IDs |
|---|---|---|
| `OR:` | OpenRouter | `openai/gpt-4o-mini`, `google/gemini-2.5-flash`, `meta-llama/llama-3.3-70b-instruct`, `openai/gpt-4o` |
| `GROQ:` | Groq | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768` |
| `DS:` | DeepSeek | `deepseek-chat`, `deepseek-reasoner` |
| `AR:` | AgentRouter | Provider routing is configured; add a model ID to `SUPPORTED_MODELS` before exposing it in the UI |

Provider API keys can be supplied as server environment variables or entered in My Profile for the current app session. Browser-entered keys are sent with PromptPulse API requests and are not stored in the database or browser storage.

## Environment variables

Create a `.env` file in the repository root. Configure only the providers you intend to use.

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET_KEY=replace-with-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-unique-strong-password

TAVILY_API_KEY=tvly-...
OPENROUTER_API_KEY=sk-or-v1-...
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=...
AGENTROUTER_API_KEY=...

# Optional shared gateway overrides
LLM_BASE_URL=
LLM_API_KEY=

# Optional separate demo credentials
DEMO_OPENROUTER_API_KEY=
DEMO_GROQ_API_KEY=
DEMO_TAVILY_API_KEY=
```

The backend loads environment values from the root `.env` file. `JWT_SECRET_KEY` must be set to a stable random value in deployed environments; otherwise a temporary process secret is generated and tokens will not survive a restart. Do not commit real credentials.

## Local development

### Prerequisites

- Python 3.11 or newer (use the version required by your deployment lockfile)
- Node.js 18 or newer
- PostgreSQL, or a compatible SQLAlchemy database URL for local testing

### Backend

From the repository root:

```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

The API health endpoint is `http://127.0.0.1:8000/health`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` to `http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` to change the development backend target. For a deployed frontend, set `VITE_API_BASE_URL` if the API is not mounted at `/api` on the same origin.

## Account and project data model

- `users` stores registered accounts, unique usernames/emails, password hashes and optional profile images.
- Passwords are hashed with PBKDF2-HMAC-SHA256; plaintext passwords are never stored.
- `projects.owner_id` scopes each registered user's projects. Project, prompt, batch, execution, settings, summary and citation endpoints enforce ownership.
- Administrator access is cross-project and is disabled unless `ADMIN_PASSWORD` is configured. The demo account can access legacy projects without an owner.
- `project_settings` stores brand context, selected engines and schedule preferences independently of account profile settings.
- Existing databases receive an additive startup migration for `projects.owner_id` and its index. New tables are created through SQLAlchemy metadata initialization.

## API routes added/used by the workspace

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create an account and issue a token |
| `POST` | `/auth/login` | Authenticate a registered, demo or administrator account |
| `GET` / `PATCH` | `/auth/me` | Read or update account profile |
| `POST` | `/auth/change-password` | Verify and change the account password |
| `GET` | `/projects` | List projects visible to the current account |
| `POST` | `/projects` | Create an owned project |
| `GET` / `PATCH` / `DELETE` | `/projects/{id}` | Read, update or delete a project |
| `GET` / `PUT` | `/projects/{id}/settings` | Read or persist project settings |
| `GET` / `POST` | `/projects/{id}/prompts` | List or add prompts |
| `POST` | `/projects/{id}/prompts/bulk` | Add multiple prompts |
| `PATCH` | `/prompts/{id}` | Activate or pause a prompt |
| `PATCH` | `/prompts/{id}/content` | Edit prompt text without changing its ID |
| `DELETE` | `/prompts/{id}` | Delete a prompt and its execution history |
| `POST` | `/projects/{id}/runs` | Start a tracking batch |
| `GET` | `/projects/{id}/results` | Retrieve project executions |
| `DELETE` | `/projects/{id}/results` | Clear project execution history |
| `DELETE` | `/executions/{id}` | Delete one execution |
| `GET` | `/projects/{id}/summary` | Retrieve visibility and competitor metrics |
| `GET` | `/projects/{id}/citations` | Retrieve domain citation metrics |

The backend mounts its API routers with and without the `/api` prefix. The frontend uses `/api` by default.

## Current limitations

- Project schedule preferences are persisted, but automatic daily/weekly/monthly execution requires a scheduler/worker service to be configured.
- Password changes are supported. Password-reset email delivery is not enabled until an email provider and reset-token flow are configured.
- Tracking currently queues selected engines sequentially using the existing single-engine batch endpoint; it does not yet use a separate parallel multi-provider cycle resource.
- Provider API keys entered in My Profile remain in frontend memory and are cleared on logout or refresh. They are not persisted to the user account.
- The demo and administrator accounts are managed through environment-configured credentials and cannot edit their profile through the registered-account profile endpoint.

## Tests and checks

Backend tests live in `backend/tests`. Run them with:

```bash
python -m pytest -q backend/tests
```

For local testing, configure a valid `DATABASE_URL` and install the dependencies in `requirements.txt`.
