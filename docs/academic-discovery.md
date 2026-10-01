# Academic discovery and refresh

Northstar performs deterministic retrieval, versioning, persistence, deduplication, scheduling, and actions. ChatGPT may remain an interactive query planner through MCP, but core interpretation can now run through Groq or Ollama worker jobs. Use `research_academic_url`, `research_university`, `research_program`, or `research_professor` only for public pages. The crawler honors robots directives, bounded page/size/time budgets, normal rate limits, and rejects obvious private hosts/IPs. It does not bypass authentication, CAPTCHA, or protected portals and must not scrape authenticated LinkedIn.

Manual URL ingestion works immediately. `academic_sources` and watchlists are designed for later first-party adapters including DAAD, EURAXESS, Erasmus Mundus, national scholarship portals, and university/research vacancy pages. A changed content hash marks the source changed and surfaces it on Academic Today. The worker does not pretend ChatGPT is continuously running.

The default sequence is **Tavily Search API → Northstar retrieval → immutable official-page version → evidence → Groq reasoning**, with Ollama as the reasoning fallback where configured. Tavily supplies URLs and snippets only; answer generation is disabled. Search-result text is a discovery signal and never evidence. Northstar must independently retrieve an official page before an opportunity or funding claim is created.

`ACADEMIC_SEARCH_PROVIDER` supports `tavily` (default), `groq` (experimental compatibility), and `none`. Groq browser search is disabled by default and is never called automatically when Tavily fails. Tavily authentication, rate-limit, timeout, malformed-response, and upstream failures are recorded without secrets, then Northstar checks curated official sources and marks the run `PARTIAL`. Provenance remains distinct as `TAVILY_DISCOVERY`, `GROQ_DISCOVERY`, `CURATED_FALLBACK`, or `MANUAL_SOURCE`.

Northstar generates 4–8 deterministic, country-aware queries rather than one large prompt. Identical normalized query/depth/limit combinations are cached in the local database for `ACADEMIC_DISCOVERY_CACHE_HOURS` (24 by default). URLs are normalized and deduplicated before official-source classification and crawling. Limits bound queries, results, candidates, and official page retrievals.

Tavily currently advertises a free usage tier, but external quotas, availability, and pricing may change. Check Tavily's current terms before relying on it.
