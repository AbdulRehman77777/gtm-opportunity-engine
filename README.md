# Northstar GTM Opportunity Engine

A local-first opportunity intelligence system for U.S. AI, LLM, Python, full-stack, SaaS, and automation work. Northstar keeps client acquisition and job acquisition as separate funnels while preserving shared source evidence and complete history.

## Milestone 1: Opportunity Intelligence Engine

Implemented today:

- Greenhouse, Lever, and Ashby public job-board adapters
- manual URL and CSV imports
- canonical company/domain normalization
- cross-source job deduplication with raw source history
- independent client and job scoring with component snapshots
- evidence-backed hiring signals and append-only activities
- durable, retryable SQLite worker queue and source-run metrics
- Fastify API and responsive React/Tailwind Today dashboard
- conversion metric primitives and guarded pipeline transitions

No email sending, authenticated LinkedIn scraping, browser automation, or autonomous applying exists in this milestone.

## Milestone 2: Company Intelligence Engine

Promising opportunities can now be researched asynchronously. The staged worker resolves a supported company domain, performs a bounded first-party crawl, stores page versions, extracts deterministic evidence, creates severity-weighted signals, optionally requests schema-validated Ollama analysis, builds a versioned company profile, and appends enriched score snapshots.

Open an opportunity in the dashboard to see its company intelligence view, evidence ledger, signals, score changes, research history, and **Research now** action. Ollama is optional: `/health/ollama` reports `available`, `unavailable`, or `misconfigured`, and deterministic research continues when it is offline.

## Run locally

Prerequisites: Node.js 22+, Corepack, and build tools supported by `better-sqlite3`.

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:5173`. The API listens on `http://localhost:4100`.

On newer Node versions without a prebuilt SQLite binary, run `pnpm rebuild better-sqlite3` once.

## Add a source

Use **Configure a source** in the empty dashboard, or create one through the API:

```bash
curl -X POST http://localhost:4100/api/sources \
  -H 'content-type: application/json' \
  -d '{"kind":"GREENHOUSE","name":"Example company","config":{"boardToken":"example","companyName":"Example company","companyDomain":"example.com"}}'
```

Greenhouse expects `boardToken`; Lever expects `site`; Ashby expects `boardName`. Company name and domain are explicit because ATS hosts do not reliably expose the company’s canonical website.

Queue all enabled public sources:

```bash
curl -X POST http://localhost:4100/api/discovery-runs/all
```

The worker performs retrieval and ingestion outside the HTTP request.

Eligible companies are automatically queued when job score ≥65 or client score ≥60. Configure these with `MIN_RESEARCH_JOB_SCORE` and `MIN_RESEARCH_CLIENT_SCORE`. Crawl limits and cache freshness are documented in [Company Intelligence](docs/company-intelligence.md).

After company research, client leads scoring at least 75 are eligible for public decision-maker and contact intelligence. Configure `MIN_CONTACT_CLIENT_SCORE`, `CONTACT_CACHE_TTL_DAYS`, and `DNS_CACHE_TTL_DAYS`; see [Contact Intelligence](docs/contact-intelligence.md). This pipeline does not send email or automate LinkedIn.

## Operations and analytics

Configure SMTP/IMAP only in `.env`; passwords are never displayed by the API. The worker schedules follow-ups, analytics, model-eligibility checks, and IMAP polling when `IMAP_HOST`, `IMAP_USER`, and `IMAP_PASSWORD` are configured. Health endpoints: `/health/smtp`, `/health/imap`, and `/health/scheduler`.

Analytics and models use immutable conversion events. Historical probability remains unavailable until `MIN_MODEL_SAMPLES` and class-balance thresholds are met; it never replaces the heuristic opportunity score. Campaigns, exports, and a manual SQLite backup are available through the dashboard/API. See [analytics.md](docs/analytics.md) and [operations.md](docs/operations.md).

## CSV columns

Required: `company_name`, `title`, `source_url` (or `url`). Optional: `external_id`, `company_domain`, `description`, `location`, `country`, `remote_type`, `employment_type`, `compensation`, `posted_at`.

POST JSON to `/api/imports/csv` as `{ "sourceName": "My import", "csv": "..." }`. Row validation errors are reported without discarding valid rows.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Architecture and operational decisions are in [`docs/`](docs/architecture.md).
