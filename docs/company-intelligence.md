# Company Intelligence Engine

## Purpose

Company intelligence turns a promising discovered opportunity into a traceable answer to: what the company does, what is happening, why its needs match our services, and what action is justified. Conclusions are derived from stored evidence; hypotheses are labeled and never promoted to facts.

## Pipeline

`eligibility -> domain resolution -> bounded crawl -> deterministic extraction -> signal detection -> optional AI analysis -> profile -> enriched score snapshot -> explanation`

Each phase is a durable worker job. The API only queues research. Automatic eligibility defaults to job score ≥65 or client score ≥60; a manual request always qualifies. Thresholds and crawler budgets are environment-configurable.

## Domain resolution

Resolution considers, in descending order: an existing normalized company domain, user/source metadata, first-party links embedded in job descriptions, and safe same-company URL evidence. ATS, vendor, and social domains are excluded. Each attempt stores the candidate, method, confidence, evidence URL, and timestamp. No candidate is accepted as high confidence merely because it resembles the company name.

## Crawl boundaries

The crawler uses normal HTTP requests and Cheerio. It follows redirects, validates HTML content type, caps response bytes, retries transient failures with exponential backoff, honors `Retry-After`, checks robots directives, restricts navigation to the resolved domain, and applies global/per-domain concurrency. Playwright is intentionally absent from the default path and can be added later only for specific allowed sites that return unusable HTML.

Homepage navigation, footer links, and sitemap entries are ranked against a route vocabulary. The highest-value 10–15 pages are fetched; the whole site is never crawled. Cache freshness defaults to 14 days.

## Evidence and facts

Deterministic extraction handles titles, metadata, headings, main text, JSON-LD, links, email addresses, social URLs, product/API/AI language, hiring language, pricing, customer/case-study pages, and contactability. Every evidence row includes a concise claim, excerpt, URL, source quality, extractor, confidence, and fact/observation/hypothesis classification.

Signals reference evidence rows. Direct first-party hiring and product evidence outranks weak absence-based observations. Weak signals cannot dominate enriched scores.

## AI boundary

`AIProvider` exposes structured generation, health, and model information. `OllamaProvider` validates all output with Zod, stores prompt/version/input hash/output/latency/failure metadata, and can be replaced without changing research orchestration. AI receives bounded cleaned evidence, not raw pages. Its facts must cite evidence IDs; uncited output is retained only as a hypothesis or risk. Ollama failure never prevents deterministic profile creation.

## History and cache

`company_pages` stores stable URL identity; `company_page_versions` stores content changes; `research_run_pages` records reuse or fetch activity per run. `company_research_runs`, `domain_resolutions`, `evidence`, `ai_runs`, and score tables are historical. `company_profiles` is versioned, while the company points to its current profile. Research becomes stale at `next_research_after`, normally 14 days, unless forced or a new material signal arrives.

## Research states

`NOT_RESEARCHED`, `QUEUED`, `RESOLVING_DOMAIN`, `CRAWLING`, `EXTRACTING`, `AI_ANALYSIS`, `SCORING`, `COMPLETE`, `PARTIAL`, `FAILED`.

No domain is `FAILED`. Useful deterministic results with an AI failure are `PARTIAL`. A complete deterministic run with zero AI dependency may be `COMPLETE`; the profile records whether AI contributed.
