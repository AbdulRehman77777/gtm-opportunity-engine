# Academic discovery and refresh

ChatGPT is the interactive query planner. Northstar performs deterministic retrieval, versioning, persistence, deduplication, scheduling, and actions. Use `research_academic_url`, `research_university`, `research_program`, or `research_professor` only for public pages. The crawler honors robots directives, bounded page/size/time budgets, normal rate limits, and rejects obvious private hosts/IPs. It does not bypass authentication, CAPTCHA, or protected portals and must not scrape authenticated LinkedIn.

Manual URL ingestion works immediately. `academic_sources` and watchlists are designed for later first-party adapters including DAAD, EURAXESS, Erasmus Mundus, national scholarship portals, and university/research vacancy pages. A changed content hash marks the source changed and surfaces it on Academic Today. The worker does not pretend ChatGPT is continuously running.
