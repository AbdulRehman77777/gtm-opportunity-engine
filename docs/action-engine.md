# Action engine

The action layer connects evidence-backed opportunities to human-approved work. Client records follow service match → strategy → immutable message versions → approval → idempotent SMTP send → scheduled follow-ups → reply classification → CRM outcome/deal. Job records follow canonical candidate profile → deterministic match → immutable application materials → manual submission → status and conversion history.

Safety invariants: only approved versions can send; inferred contacts require explicit confirmation; suppression, confidence, hourly/daily limits, and idempotency are checked before provider I/O. LinkedIn remains manual. SMTP/IMAP health endpoints never expose credentials. Ollama is optional; deterministic grounded fallbacks keep queues usable while it is offline.
