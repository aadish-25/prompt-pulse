# PromptPulse frontend

React 18 + Vite frontend for the PromptPulse FastAPI backend.

## Run locally

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Start the backend separately:

```bash
pip install -r requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

Vite proxies `/api` to `http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` to change the development backend target. For a deployed frontend, set `VITE_API_BASE_URL` if the API is not mounted at `/api` on the same origin.

## Main workflow

1. Public landing page, `/login`, and `/register` account routes.
2. Account profile: username, email, profile image, password change and session-only provider API keys.
3. Project onboarding: brand identity, AI engines and tracking cadence.
4. Overview: brand visibility, cited domains, recent runs and competitor mentions.
5. Prompt Library: add one or multiple prompts, edit/activate/pause, search and paginate.
6. Tracking: start cycles and filter executions by status, batch, round and date.
7. Run Analysis: inspect a selected prompt's answer, target sentiment, brand remark, matched mentions, competitors and sources.
8. Sources & citations and Competitors: project-wide source and competitor intelligence.
9. Project Settings: brand identity, context, engines, schedule preferences and project danger zone.

## Account vs project settings

- **My Profile** contains account details, avatar, password and provider API keys.
- **Project Settings** contains brand identity/context, selected AI engines, schedule preferences and project deletion.
- The sidebar three-dot menu and top-right account menu expose Profile, Settings and Logout.
- Registered accounts see only their own projects. The demo account retains access to legacy projects without an owner; administrator access is cross-project.

## Persistence and limitations

- Registration, login, profile updates, password changes, project editing, project settings and prompt-text editing use backend endpoints.
- Existing databases are migrated additively at startup with `projects.owner_id`; project preferences are stored in `project_settings`.
- Provider API keys stay in frontend memory for the current app session. They are not written to localStorage or the database and are cleared on logout or refresh.
- Schedule preferences persist, but actual scheduled execution still requires a scheduler service. Password-reset email delivery requires an email provider and is not enabled.
- Prompt Library search filters the already-loaded prompt list; it does not issue an API request for each keystroke.
- The universal workspace search can route to matching prompts, tracking runs, sources, competitors and workspace sections.
- Destructive actions use in-app confirmation dialogs rather than browser alerts.

## UI audit scope

The revision includes light/dark contrast, responsive layouts, overflow and scroll behavior, hover/focus states, typography hierarchy, form placeholders, empty states, pagination, modal sizing and own-domain emphasis across Overview, Analysis and Sources.
