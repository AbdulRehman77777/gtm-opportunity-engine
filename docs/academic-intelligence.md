# Northstar Academic Intelligence

Academic Intelligence is a private workspace for converting scattered official university, program, funding, and professor information into persistent cases for Abdul Rehman. It is not a public SaaS or a scholarship directory. Academic records are isolated from client and job opportunities while sharing the durable worker queue and append-only activity infrastructure.

The seeded profile contains Abdul's two completed bachelor's degrees, professional and teaching background, research interests, and manuscript. The manuscript starts as `MANUSCRIPT`, never `PUBLISHED`. Edit the profile in **Academic Intelligence → Applicant Profile** or through API/MCP.

Workflow: discover official source → queue deterministic refresh → store immutable page version → save precise evidence → canonicalize university/program/professor → classify funding → evaluate eligibility → score for priority → create application/professor case → draft outreach → human approval → send → reply/follow-up history.

Run `pnpm db:migrate`, then `pnpm dev` and `pnpm dev:mcp`. The dashboard is at `http://localhost:5173`; MCP defaults to `http://127.0.0.1:4200/mcp`. Ollama remains optional and is not used by the deterministic academic path.

Current limitations: academic page refresh stores clean page versions but does not autonomously interpret free-form requirements; ChatGPT supplies interactive interpretation through MCP. Gmail OAuth is not implemented. SMTP/IMAP remain the initial providers. Local document records support PDF/DOCX and do not expose storage paths.
