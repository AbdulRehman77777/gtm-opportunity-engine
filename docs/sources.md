# Sources

Sources implement `OpportunitySource` and return normalized records plus the untouched raw provider record. Adapters are independent and paginated where supported.

- Greenhouse: public board API (`boards-api.greenhouse.io`).
- Lever: public postings API (`api.lever.co`).
- Ashby: public job-board API (`api.ashbyhq.com/posting-api`).
- Manual URL: validated operator-provided observation.
- CSV: explicit header mapping with row-level validation errors.

Source configurations store public board identifiers, enabled state, conservative limits, and checkpoints. Terms, robots directives where applicable, Retry-After, and authentication boundaries must be honored.
