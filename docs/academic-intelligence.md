# Northstar Academic Intelligence

Academic Intelligence is a private workspace for converting scattered official university, program, funding, and professor information into persistent cases for Abdul Rehman. It is not a public SaaS or a scholarship directory. Academic records are isolated from client and job opportunities while sharing the durable worker queue and append-only activity infrastructure.

The seeded profile contains Abdul's two completed bachelor's degrees, professional and teaching background, research interests, and manuscript. The manuscript starts as `MANUSCRIPT`, never `PUBLISHED`. Edit the profile in **Academic Intelligence → Applicant Profile** or through API/MCP.

Workflow: discover official source → queue deterministic refresh → store immutable page version → save precise evidence → canonicalize university/program/professor → classify funding → evaluate eligibility → score for priority → create application/professor case → draft outreach → human approval → send → reply/follow-up history.

Run `pnpm db:migrate`, then `pnpm dev` and `pnpm dev:mcp`. The dashboard is at `http://localhost:5173`; MCP defaults to `http://127.0.0.1:4200/mcp`.

AI enrichment uses the shared provider-neutral layer. In `auto`, Groq is health-checked first and Ollama is tried when Groq is missing, unavailable, or rate-limited. If neither works, the job records a skipped/failed run and the deterministic academic system remains usable. Explicit `groq` and `ollama` modes never silently switch providers; `none` disables AI. The Academic workspace shows the active provider and each stored analysis retains its actual provider and model.

Academic AI jobs analyze promising opportunities, professor fit, and draft outreach from bounded applicant data plus stored evidence. They never treat model output as source evidence: unsupported factual observations become `UNKNOWN`, research ideas remain hypotheses, and deterministic funding/eligibility records remain authoritative. Identical inputs reuse cached results until `AI_CACHE_TTL_DAYS`; daily and per-run limits prevent broad unprioritized analysis.

Current limitations: AI interpretation begins only after official evidence has been retrieved and stored; optional Groq browser search is disabled and is not an evidence source. Gmail OAuth is not implemented. SMTP/IMAP remain the initial providers. Local document records support PDF/DOCX and do not expose storage paths.
