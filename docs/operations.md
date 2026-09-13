# Operations

The worker schedules durable SQLite-backed inbox polling, follow-up processing, daily analytics, and weekly model evaluation through scheduler leases. IMAP UID checkpoints advance only after polling and avoid repeated processing across restarts. SMTP and IMAP credentials are environment-only.

Back up locally with `POST /api/backups` or the repository backup command. Backups are timestamped and never overwrite the prior copy. Restore by stopping API/worker, replacing the SQLite database with a selected backup, then restarting. Keep the original database until the restored instance passes `/health/db`.
