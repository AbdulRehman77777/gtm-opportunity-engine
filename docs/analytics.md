# Analytics and learning

Funnels are calculated from immutable `conversion_events`; current CRM status is never substituted for historical outcomes. Analytics exposes client/job funnels, source revenue, cohorts, and quality metrics. Cohorts are only surfaced after the configured minimum sample and include sample size, successes, baseline, and reliability.

Heuristic opportunity scores remain separate from historical probabilities. The interpretable logistic model trains only after `MIN_MODEL_SAMPLES`, positive, and negative thresholds are met. It uses a time-ordered holdout and stores its feature version, metrics, calibration status, and reproducible training window. Poorly calibrated models are retained for evaluation but not surfaced as precise probabilities. Recommendations never alter score weights; accepting one records a human decision only.
