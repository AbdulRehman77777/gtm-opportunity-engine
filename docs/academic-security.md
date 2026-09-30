# Academic security

Production requires `MCP_BEARER_TOKEN`; token comparison is timing-safe. `ALLOWED_ORIGINS` replaces unrestricted production CORS. Secrets remain environment-only and are never returned. Inputs use Zod. Documents are size-limited PDF/DOCX blobs, receive generated storage keys, and APIs expose metadata rather than local paths.

Academic crawling inherits robots awareness, timeouts, response limits, bounded concurrency, and private-host checks. Operators should deploy behind TLS and network controls. Email requires explicit approval, idempotency, and conservative rate limits. Important state changes are recorded in activity history.

Back up with `POST /api/backups`. The configured SQLite database and `ACADEMIC_DOCUMENT_DIRECTORY` must both be backed up. Restore with services stopped, retain the original copy, restore both stores, migrate, and verify `/health/db`, the dashboard, and document metadata before resuming sends.
