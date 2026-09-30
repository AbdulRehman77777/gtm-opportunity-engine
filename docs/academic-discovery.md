# Academic discovery and refresh

Northstar performs deterministic retrieval, versioning, persistence, deduplication, scheduling, and actions. ChatGPT may remain an interactive query planner through MCP, but core interpretation can now run through Groq or Ollama worker jobs. Use `research_academic_url`, `research_university`, `research_program`, or `research_professor` only for public pages. The crawler honors robots directives, bounded page/size/time budgets, normal rate limits, and rejects obvious private hosts/IPs. It does not bypass authentication, CAPTCHA, or protected portals and must not scrape authenticated LinkedIn.

Manual URL ingestion works immediately. `academic_sources` and watchlists are designed for later first-party adapters including DAAD, EURAXESS, Erasmus Mundus, national scholarship portals, and university/research vacancy pages. A changed content hash marks the source changed and surfaces it on Academic Today. The worker does not pretend ChatGPT is continuously running.

The preferred sequence remains official URL discovery → Northstar retrieval → immutable page version → precise evidence → AI reasoning. `GROQ_BROWSER_SEARCH_ENABLED=false` by default. If discovery search is added later, its text must never become evidence; Northstar must independently retrieve and verify the official URL first.
