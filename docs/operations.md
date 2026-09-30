# Operations

The worker schedules durable SQLite-backed inbox polling, follow-up processing, daily analytics, and weekly model evaluation through scheduler leases. IMAP UID checkpoints advance only after polling and avoid repeated processing across restarts. SMTP and IMAP credentials are environment-only.

Academic AI analysis also runs in the durable queue (`ANALYZE_ACADEMIC_OPPORTUNITY_AI`, `ANALYZE_PROFESSOR_AI`, `GENERATE_ACADEMIC_OUTREACH_AI`). Runs retain task, prompt version, normalized input hash, output, provider/model, latency, tokens, status, and safe error text. `AI_MAX_DAILY_REQUESTS`, `AI_MAX_RESEARCH_ITEMS_PER_RUN`, and `AI_CACHE_TTL_DAYS` constrain quota usage. Provider failures complete with deterministic behavior rather than retrying indefinitely. Email generation creates a draft only; approval, idempotency, and send limits remain separate gates.

Back up locally with `POST /api/backups` or the repository backup command. Backups are timestamped and never overwrite the prior copy. Restore by stopping API/worker, replacing the SQLite database with a selected backup, then restarting. Keep the original database until the restored instance passes `/health/db`.
