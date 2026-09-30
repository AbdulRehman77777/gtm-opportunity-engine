# Academic email workflow

Professor research → evidence-backed context → ChatGPT writes personalized draft → Northstar stores exact text and evidence IDs → user selects document IDs → explicit approval → individual or approved-only batch queue → SMTP send → provider result → IMAP/reply state → follow-up.

Research and draft creation cannot send. A missing recipient blocks approval; a non-approved message blocks queueing; unique idempotency keys prevent duplicate jobs. Shared hourly/daily limits and environment-only SMTP credentials apply. Suppression/bounce infrastructure remains available from GTM operations; deeper academic reply-thread matching is a current extension point. Gmail OAuth can implement the existing provider interface later.
