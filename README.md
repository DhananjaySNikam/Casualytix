# Causalytix

An engineering workspace for investigating **software and hardware failures**. Start with an incident brief, attach the relevant evidence, and get ranked hypotheses, an interactive Ishikawa map, five-level Why chains, corrective actions, and verification tests. The workflow follows the supplied **CAUSALYTIX System Design Specification v1.0**.

**Project-report materials:** [Notion diagram atlas](https://app.notion.com/p/CAUSALYTIX-Project-Report-Diagram-Atlas-41c3502181d78100893ddb122e49401a) · [Printable atlas PDF](public/assets/causalytix-diagram-atlas.pdf) · [Editable diagrams](docs/DIAGRAMS.md).

## Run it

Requires Node.js 22+, npm, and Python 3.11+ with `venv` and `pip`. No model key, cloud account, or database installation is required for local investigations.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173** on your machine, or use the **Causalytix workspace** live preview in Arena. The launcher creates `.venv`, installs Python dependencies, builds the UI, and starts one same-origin FastAPI server. The first visit creates a private SQLite workspace with eight **illustrative starter cases**. Fonts, illustrations, and diagram rendering assets are bundled; there are no runtime CDN dependencies.

- **Try the workflow:** New investigation → Software or Hardware → describe the observed/expected behavior and affected system → add evidence → Review & analyze → Run analysis.
- **Try a hardware example:** A field controller resets when a load starts. Attach a time-aligned voltage trace and reset log. Inspect the power-delivery hypothesis, its source passage, and its proposed verification test. A voltage drop is a lead, not proof of a defective supply.
- **Explore a completed example:** Open *API gateway latency spike*, select **Causal map**, choose a numbered cause, then follow its **5-Why chain**. **Solutions** separates containment, prevention and verification.
- **Find work:** Search by title or case ID with `Ctrl/Cmd + K`; use the investigation, evidence and report indexes. Metric cards open the corresponding filtered records.
- **Development:** `npm run build` rebuilds the UI; `npm run ui:dev` optionally serves a hot-reload frontend on 5174, proxying `/api` to the running backend on 5173. Set `PORT` in the shell to change the single-server port. The API contract is available at `/api/docs`.

### Docker alternative

```sh
docker compose up --build
```

The multistage image serves the SPA and API on port 5173 as a non-root user. The `workspace_data` volume preserves the database **and its session signing key** across container restarts. Configure any model endpoint so it is reachable from the container; container loopback is not the host machine.

## Analysis engines

| Mode | What actually runs | Setup |
| --- | --- | --- |
| Local classifier | A multinomial naive Bayes classifier trained on labelled engineering examples selects domain-specific failure mechanisms, five-level playbooks, remedies and tests. Out-of-vocabulary input can abstain. | Ready by default; no network calls. |
| Language model | Two OpenAI-compatible JSON completions: propose categorized candidates and impact, then expand their causal links, containment, prevention and verification using retrieved evidence. Pydantic validates both responses. | Configure a server-side endpoint, restart, and select the language model at the review step. |

Copy `.env.example` to `.env`. For OpenAI, set `OPENAI_API_KEY` and optionally `LLM_MODEL` (default: `gpt-4o-mini`). For a local model that supports chat completions and JSON mode, set, for example:

```dotenv
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=llama3.2
```

The model must already be installed and serving requests. **Never put a model key in a `VITE_` variable.** Selecting a network model sends the brief, retrieved passages, and relevant prior-case titles to that endpoint. A timeout or invalid output falls back to the local classifier and is identified in the saved report. The offline model is a limited diagnostic baseline, **not** a generative LLM.

### How to interpret a result

1. Up to six documents per case: `.log`, `.txt`, `.csv`, `.md`, `.json`, text-layer `.pdf`, or pasted design/bench notes. Limits: 2 MB per file, 80,000 extracted characters per item, 30 pages per PDF. Images, CAD binaries and scanned PDFs need a text description or transcript. The database keeps extracted text, not the original binary.
2. The index uses 760-character passages with 120-character overlap. A deterministic, normalized **256-dimensional log-TF feature hash** with domain aliases works without model downloads. This is lexical retrieval, not a neural sentence encoder.
3. Each cause and each Why statement is matched independently against the current incident’s passages. A cosine match below `0.20` is marked **Needs evidence**. A source reference opens the actual excerpt and original document.
4. `rank = round(100 × (0.50 × evidence + 0.30 × impact + 0.20 × history))`. Local impact maps Low/Medium/High/Critical to `.25/.50/.75/1`; language-model impact is validated in `[0,1]`. History counts similar **human-confirmed** mechanisms in other resolved cases of the same domain and workspace, saturating at three. Examples never inflate real-case scores.
5. **Human verification gate:** to resolve an investigation, select the cause you confirmed and record the observed test result. Only that mechanism feeds future history. Reopening or reanalysis clears the active verification. Editing and saving as a draft invalidates the prior report; export first if you need to retain it.

A rank score is **not a calibrated probability**. Textual similarity does not establish causality. The application suggests checks; it does not execute commands, change infrastructure, or operate hardware.

## Local database and Supabase

**Local is the system of record.** SQLite (WAL mode, foreign keys, transactional writes) stores workspaces, incidents, evidence documents, passage vectors, cause/Why nodes and report payloads in `.data/workspace.sqlite3`. `CAUSALYTIX_DATA` overrides the directory. A signed HTTP-only session cookie scopes every API lookup to one workspace. It is not a local account recovery mechanism: export or archive valuable cases before clearing cookies or allowing the session to expire.

**Cloud archival is explicit.** A dedicated [Causalytix Supabase project](https://supabase.com/dashboard/project/jmnlnhyfdswfyphfeqdp) was provisioned on the free plan in `ap-south-1`. The original inactive project was not changed. The client ships only the dedicated project's **public** URL and publishable key, never a service key or database password.

1. Open **System settings → Supabase archive** and create an account or sign in. If email confirmation is enabled, confirm your address before signing in.
2. Open a case → **Archive to cloud → Save to cloud**. This includes the incident, extracted evidence text, passage vectors, causal nodes and latest report. Nothing is uploaded simply by launching the app or signing in.
3. From System settings, download an archived snapshot as JSON or restore its brief and evidence as a **new local draft**. The original cloud report remains intact. Re-archiving the same local ID updates its snapshot transactionally. A cloud failure never rolls back a successful local save.

The five cloud tables (`cx_incidents`, `cx_evidence_docs`, `cx_document_chunks`, `cx_cause_nodes`, `cx_reports`) have owner-scoped row-level policies. Composite foreign keys include `owner_id`; the `cx_save_case` RPC runs with the caller’s privileges. Anonymous clients cannot read or write archive records.

**To use another Supabase project:** apply [`supabase/migrations/202611180001_causalytix.sql`](supabase/migrations/202611180001_causalytix.sql) once in the target project. Configure Email Auth and appropriate Site URL/redirect URLs for your deployment. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` before rebuilding the frontend. With Docker, pass those two as build arguments. The application does not need a database administrator password; manage and rotate that separately through Supabase. Cloud operations require browser network access to the chosen project.

## Diagrams and reports

**Per investigation:** clickable SVG Ishikawa branches, five linked Why nodes per candidate, source inspection, and a solution plan. Export a paginated **PDF** or machine-readable **JSON** from the case or report index.

**For the project report:** the [Notion page](https://app.notion.com/p/CAUSALYTIX-Project-Report-Diagram-Atlas-41c3502181d78100893ddb122e49401a), in-app **Diagram library**, and [12-page PDF atlas](public/assets/causalytix-diagram-atlas.pdf) cover system context/use cases, component architecture, the nine-stage flow, evidence data flow, analysis sequence, ERD, Ishikawa mapping, 5-Why expansion, ranking, case lifecycle and deployment boundaries. Each figure also has standalone SVG and Mermaid source in `public/assets/atlas/`.

## Tests

```sh
npm test                              # isolated SQLite + API + inference tests
npm run build                          # production frontend build
npm --prefix tests/integration ci
npm --prefix tests/integration run test:archive  # real PostgreSQL engine in WASM, incl. pgvector
```

To run the browser journey, start the app, install a Playwright Chromium browser (`cd tests/integration && npx playwright install chromium`), then run `npm --prefix tests/integration run test:browser`. Set `CHROMIUM_PATH` to use an installed Chromium executable instead, or `E2E_BASE_URL` to change the app URL. Tests use an isolated browser session and do not sign up a cloud user, send email, or call a paid LLM. The model adapter’s success and failure paths use controlled responses. Cloud SQL tests exercise atomic updates, rollback, vector dimensions, cross-user isolation and anonymous denial without touching the live project.

## Layout and deployment notes

- `src/` — React interface, route handling, optional lazy-loaded Supabase client.
- `backend/` — FastAPI routes, validated contracts, classifier/playbooks, retrieval, repository and PDF renderer.
- `supabase/migrations/` — reproducible PostgreSQL/pgvector schema and archive RPC.
- `docs/`, `public/assets/atlas/` — report figures and their editable sources.
- `tests/` — service, inference, database policy and browser checks.

Use a trusted local host or authenticated reverse proxy. The local cookie isolates browser workspaces; it is **not** organization-wide access control. For shared deployments, enforce HTTPS, access control, rate/budget limits for model calls, storage quotas and backups at the boundary. Protect the database volume: SQLite text is not encrypted by the application. Redact credentials and personal data before upload. Back up the database with SQLite’s backup facility or while the server is stopped, and retain the signing key securely. No performance or accuracy gains from the design document are claimed as measured outcomes.
