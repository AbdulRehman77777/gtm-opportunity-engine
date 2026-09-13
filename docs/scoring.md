# Deterministic scoring

Milestone 1 scores are transparent prioritization heuristics, never statistical probabilities.

Client score components total 100: ICP fit 20, buying intent 25, technical opportunity 20, urgency 10, ability to pay 5, company quality 5, decision maker 5, contactability 5, evidence confidence 5.

Job score components total 100: technical match 30, AI relevance 20, experience 15, seniority 10, location 10, compensation 5, company attractiveness 5, freshness 5.

Missing information receives no invented credit. Each snapshot stores components, reasons, weight version, and evidence references. A later analytics layer may recommend weight changes, but never silently changes them.

Milestone 2 preserves `initialScore` and appends `heuristic-v2` snapshots after company research. Enrichment can increase existing components only within their original caps. Direct evidence-backed signals influence buying intent and technical opportunity; research confidence controls evidence confidence; leadership/contact evidence controls contactability. Weak absence-based observations are not allowed to outweigh first-party hiring or product evidence.
