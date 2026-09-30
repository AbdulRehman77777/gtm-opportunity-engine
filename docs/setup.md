# Local setup

1. Copy `.env.example` to `.env` and adjust local settings.
2. Enable Corepack and install packages with pnpm.
3. Run `pnpm db:migrate`.
4. Run `pnpm dev` for API, worker, and web.
5. Open `http://localhost:5173`; API health is at `http://localhost:4100/health`.

Source discovery can be queued through the API. CSV and manual imports are synchronous bounded operations; remote board fetches are handled by the worker.

AI is optional for deterministic research. The preferred setup uses `AI_PROVIDER=auto` with a Groq key and an optional Ollama fallback. Use `AI_PROVIDER=ollama` for a completely local setup or `AI_PROVIDER=none` for deterministic-only operation. Check `/health/ai` before debugging enrichment; `/health/ollama` remains available for local-provider diagnostics. No provider outage blocks crawling, evidence extraction, profiles, or deterministic scores.
