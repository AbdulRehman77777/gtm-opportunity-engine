# Local setup

1. Copy `.env.example` to `.env` and adjust local settings.
2. Enable Corepack and install packages with pnpm.
3. Run `pnpm db:migrate`.
4. Run `pnpm dev` for API, worker, and web.
5. Open `http://localhost:5173`; API health is at `http://localhost:4100/health`.

Source discovery can be queued through the API. CSV and manual imports are synchronous bounded operations; remote board fetches are handled by the worker.

Ollama is optional for deterministic research. Install the model named by `OLLAMA_MODEL` to enable semantic enrichment. Check `/health/ollama` before debugging AI output; an unavailable model does not block crawling, evidence extraction, profiles, or enriched scores.
