# Academic data model

Migration `0007` adds academic-only canonical and historical tables without modifying GTM tables. Canonical identity is university name+country, program university+name+degree, and professor university+normalized name. `academic_sources`, immutable `academic_page_versions`, and `academic_evidence` preserve provenance. Unknown facts remain `UNKNOWN` or null.

`funding_opportunities` keeps tuition, stipend, accommodation, insurance, travel, research allowance, assistantship, contract, duration, conditions, and official URL separately. `academic_score_snapshots` and `eligibility_checks` are immutable explanations, not admission predictions. `application_cases` owns current state while shared `activities` stores transition history. `academic_outreach` uses unique idempotency keys and explicit draft/approval/send states.

Application states: `DISCOVERED → RESEARCHING → PROMISING → PROFESSOR_OUTREACH_READY → PROFESSOR_CONTACTED → PROFESSOR_REPLIED → APPLICATION_PREPARATION → APPLICATION_SUBMITTED → INTERVIEW → OFFER → FUNDED_OFFER`, with guarded rejection/archive branches.
