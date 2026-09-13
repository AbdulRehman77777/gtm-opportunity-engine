# Database model

Migrations are in `packages/db/drizzle`; the TypeScript model is `packages/db/src/schema.ts`.

Core identity tables are `companies` and `jobs`. `company_sources` and `job_sources` preserve provenance and raw records. `signals` and `signal_evidence` keep claims grounded in observations. `client_opportunities` and `job_opportunities` are separate funnel heads; their score tables hold immutable component snapshots. `activities` and `conversion_events` are append-only timelines. `source_runs` and `worker_jobs` make discovery measurable and resumable.

Monetary values use integer cents. Timestamps are UTC ISO-8601 strings. Flexible provider payloads are JSON stored as text at the boundary and validated before use.

Milestone 2 adds `company_research_runs`, `domain_resolutions`, `company_pages`, `company_page_versions`, `research_run_pages`, `evidence`, `evidence_signals`, `company_profiles`, and `ai_runs`. Page/profile/AI rows are historical. `companies.current_profile_id` is a denormalized pointer to the latest successful profile. `initial_score` is backfilled during migration while score snapshots remain the authoritative history.

Milestone 3 adds `contact_research_runs`, `people`, `person_sources`, `person_evidence`, `contacts`, `contact_sources`, `email_patterns`, `contact_validations`, `dns_cache`, and `decision_maker_selections`. Company/person identity is canonical; observations, validations, research runs, and automated/manual selections are historical. Public and inferred contact provenance is never merged.
