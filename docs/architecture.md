# GTM Opportunity Engine architecture

## Product boundary

The engine contains two deliberately separate acquisition funnels over shared facts. Client opportunities answer “could this company buy engineering services?” Job opportunities answer “should this role be pursued?” They share companies, jobs, source observations, evidence, and activity infrastructure, but have independent scores, states, actions, and conversion events.

The durable lineage is:

`source run -> raw observation -> canonical company/job -> research run/page version -> evidence -> signal -> funnel score -> action -> conversion event -> revenue`

Raw observations and duplicate source mappings are retained. Canonical records may be updated, but observations, activities, score snapshots, and conversion events are append-only.

## Runtime

- `apps/api`: Fastify HTTP boundary; validates input and schedules work. It does not perform long discovery runs.
- `apps/worker`: claims durable SQLite jobs, invokes source adapters, retries failures with backoff, and records run metrics.
- `apps/web`: React action center using TanStack Query. Milestone 1 emphasizes today’s ranked work.
- `packages/db`: Drizzle schema, migrations, connection lifecycle, and ingestion repository.
- `packages/sources`: pluggable public-source adapters for Greenhouse, Lever, Ashby, manual URLs, and CSV.
- `packages/shared`: contracts, validation, configuration, identifiers, and normalization.
- `packages/scoring`: transparent deterministic client/job score components and recommended actions.
- `packages/crawler`: bounded, robots-aware HTTP retrieval, page cleaning, internal-link ranking, and page cache contracts.
- `packages/research`: domain resolution, deterministic evidence extraction, profile assembly, and opportunity explanations.
- `packages/signals`: configurable evidence-to-signal rules with severity and source-quality weighting.
- `packages/ai`: provider-neutral structured generation with a resilient Ollama implementation.
- `packages/operations`: service selection, grounded drafts, send guardrails, reply intent, candidate matching, and scheduling.
- `packages/email`: replaceable SMTP and IMAP providers; credentials remain environment-only.

## Portability decision

SQLite is accessed only through Drizzle and a narrow repository layer. IDs are application-generated UUIDs, timestamps are ISO strings, JSON is explicit text, and business logic does not depend on SQLite row IDs. These choices keep a PostgreSQL migration mechanical. SQLite uses WAL mode and foreign keys for concurrent local API/worker use.

## Idempotency and history

Jobs use a fingerprint derived from canonical domain, normalized title, normalized location, and stable source identifiers. The canonical `jobs` row is unique by fingerprint. Every source observation is stored in `job_sources` with raw JSON and first/last seen timestamps. Ingestion is transactional and source runs keep checkpoints and counters. Re-running the same source updates freshness without duplicating the canonical opportunity.

Company research is idempotent per company and freshness window. Research requests create a durable research-run record and staged worker chain. Page identity is stable while changed content creates a new immutable version. Unchanged content reuses its version but still records the research-run/page relationship.

## Compliance defaults

Adapters use documented/public job-board endpoints and normal HTTP retrieval. No authenticated LinkedIn collection, credential storage, CAPTCHA bypass, or autonomous outreach exists. All future outbound actions begin in a human approval state.

## Milestone boundaries

Milestone 1 ends with source discovery/import, normalization, deduplication, historical mapping, deterministic two-funnel scoring, a durable worker queue, and the ranked Today dashboard.

Milestone 2 adds evidence-first company intelligence. Deterministic extraction and scoring are the required path; AI is optional enrichment. A failed crawl or unavailable Ollama model produces `PARTIAL` or `FAILED` research without deleting or blocking the opportunity. Contacts and outreach remain later layers.

Milestone 3 adds deterministic contact intelligence for high-value client leads. Stored first-party pages feed canonical person records, append-only provenance, context-aware decision-maker scoring, public contact extraction, explicitly inferred email candidates, cached DNS/MX validation, and historical manual/automatic selections. See [contact-intelligence.md](./contact-intelligence.md).

Milestone 4 adds human-approved action workflows. Immutable message/application versions, idempotent send attempts, suppression checks, durable follow-ups, email threads, tasks, conversion events, and deals preserve the source-to-revenue path. External I/O remains in worker jobs; HTTP handlers validate and queue work.

The final intelligence layer adds durable scheduler leases, IMAP checkpoints, campaign performance, source/cohort analytics, data-quality checks, timestamped SQLite backups, and eligibility-gated interpretable probability models. Statistical outputs never replace heuristic scores or automatically change scoring weights. See [analytics.md](./analytics.md) and [operations.md](./operations.md).
