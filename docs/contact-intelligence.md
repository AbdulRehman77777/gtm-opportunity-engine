# Decision Maker and Contact Intelligence

## Pipeline

`eligible client lead -> DISCOVER_COMPANY_PEOPLE -> RANK_DECISION_MAKERS -> DISCOVER_CONTACTS -> DETECT_EMAIL_PATTERN -> VALIDATE_CONTACT -> REFRESH_CONTACT_INTELLIGENCE`

The default client-score threshold is 75. Manual requests bypass eligibility. Freshness and worker idempotency prevent repeated work. Contact research consumes stored Milestone 2 page versions; it does not crawl sites again.

## Evidence and identity

People are extracted only from official stored pages and structured `Person` data. Canonical identity is company plus normalized name. Person sources and evidence preserve every supporting page and claim across runs.

Decision-maker scoring considers role, seniority, technical ownership, company context, service relevance, and source confidence. Selection history is append-only: refreshes and manual corrections deactivate, rather than delete, prior selections.

## Contacts and validation

Public emails become `PUBLIC_NAMED` when they reliably match a discovered person; others remain `PUBLIC_GENERAL`. A pattern requires at least two public named emails. Generated candidates remain `PATTERN_INFERRED`; DNS or MX success never upgrades their provenance.

Validation checks syntax, domain match, disposable domains, DNS, and MX without SMTP probing or sending. Validation snapshots are cached and historical. Contact confidence is separate from opportunity score.

The UI exposes the primary and secondary decision makers, reasons, evidence sources, contact classifications, validation state, freshness, manual refresh/selection, and safe LinkedIn profile/search links. It does not send outreach.
