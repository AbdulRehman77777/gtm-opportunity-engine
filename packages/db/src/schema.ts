import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
};

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), name: text('name').notNull(), enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  configJson: text('config_json').notNull().default('{}'), checkpoint: text('checkpoint'), lastSuccessfulAt: text('last_successful_at'), ...timestamps
}, (table) => [uniqueIndex('idx_sources_kind_name').on(table.kind, table.name)]);

export const sourceRuns = sqliteTable('source_runs', {
  id: text('id').primaryKey(), sourceId: text('source_id').notNull().references(() => sources.id), status: text('status').notNull(), startedAt: text('started_at').notNull(), completedAt: text('completed_at'),
  pagesProcessed: integer('pages_processed').notNull().default(0), recordsSeen: integer('records_seen').notNull().default(0), recordsCreated: integer('records_created').notNull().default(0),
  recordsUpdated: integer('records_updated').notNull().default(0), duplicatesDetected: integer('duplicates_detected').notNull().default(0), errors: integer('errors').notNull().default(0),
  rateLimitEvents: integer('rate_limit_events').notNull().default(0), runtimeMs: integer('runtime_ms'), checkpoint: text('checkpoint'), errorJson: text('error_json'), createdAt: text('created_at').notNull()
}, (table) => [index('idx_source_runs_source_started').on(table.sourceId, table.startedAt), index('idx_source_runs_status').on(table.status)]);

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(), canonicalName: text('canonical_name').notNull(), normalizedName: text('normalized_name').notNull(), domain: text('domain'), country: text('country'),
  description: text('description'), industry: text('industry'), resolvedDomain: text('resolved_domain'), domainResolutionMethod: text('domain_resolution_method'), domainConfidence: real('domain_confidence'), domainResolvedAt: text('domain_resolved_at'),
  researchStatus: text('research_status').notNull().default('NOT_RESEARCHED'), currentProfileId: text('current_profile_id'), lastResearchedAt: text('last_researched_at'), nextResearchAfter: text('next_research_after'),
  firstDiscoveredAt: text('first_discovered_at').notNull(), lastObservedAt: text('last_observed_at').notNull(), ...timestamps
}, (table) => [uniqueIndex('idx_companies_domain').on(table.domain), index('idx_companies_normalized_name').on(table.normalizedName), index('idx_companies_research_status').on(table.researchStatus), index('idx_companies_next_research').on(table.nextResearchAfter)]);

export const companySources = sqliteTable('company_sources', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), sourceId: text('source_id').notNull().references(() => sources.id),
  externalId: text('external_id'), sourceUrl: text('source_url'), rawDataJson: text('raw_data_json'), firstSeenAt: text('first_seen_at').notNull(), lastSeenAt: text('last_seen_at').notNull(), observationCount: integer('observation_count').notNull().default(1), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_company_sources_identity').on(table.companyId, table.sourceId), index('idx_company_sources_source').on(table.sourceId)]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), fingerprint: text('fingerprint').notNull(), title: text('title').notNull(), normalizedTitle: text('normalized_title').notNull(),
  description: text('description').notNull().default(''), location: text('location').notNull(), country: text('country'), remoteType: text('remote_type').notNull(), employmentType: text('employment_type'), compensation: text('compensation'),
  postedAt: text('posted_at'), firstDiscoveredAt: text('first_discovered_at').notNull(), lastObservedAt: text('last_observed_at').notNull(), expiredAt: text('expired_at'), ...timestamps
}, (table) => [uniqueIndex('idx_jobs_fingerprint').on(table.fingerprint), index('idx_jobs_company').on(table.companyId), index('idx_jobs_posted').on(table.postedAt)]);

export const jobSources = sqliteTable('job_sources', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id), sourceId: text('source_id').notNull().references(() => sources.id), sourceRunId: text('source_run_id').references(() => sourceRuns.id),
  externalId: text('external_id').notNull(), sourceUrl: text('source_url').notNull(), rawDataJson: text('raw_data_json').notNull(), contentHash: text('content_hash').notNull(),
  firstSeenAt: text('first_seen_at').notNull(), lastSeenAt: text('last_seen_at').notNull(), observationCount: integer('observation_count').notNull().default(1), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_job_sources_external').on(table.sourceId, table.externalId), index('idx_job_sources_job').on(table.jobId), index('idx_job_sources_run').on(table.sourceRunId)]);

export const signals = sqliteTable('signals', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), jobId: text('job_id').references(() => jobs.id), type: text('type').notNull(), claim: text('claim').notNull(),
  severity: text('severity').notNull().default('MEDIUM'), weight: integer('weight').notNull().default(0), sourceQuality: text('source_quality').notNull().default('FIRST_PARTY_HIGH'),
  confidence: real('confidence').notNull(), observedAt: text('observed_at').notNull(), detectedAt: text('detected_at').notNull().default(''), active: integer('active', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull()
}, (table) => [index('idx_signals_company_type').on(table.companyId, table.type), index('idx_signals_job').on(table.jobId)]);

export const signalEvidence = sqliteTable('signal_evidence', {
  id: text('id').primaryKey(), signalId: text('signal_id').notNull().references(() => signals.id), sourceUrl: text('source_url').notNull(), evidenceText: text('evidence_text').notNull(),
  observedAt: text('observed_at').notNull(), contentHash: text('content_hash').notNull(), createdAt: text('created_at').notNull()
}, (table) => [index('idx_signal_evidence_signal').on(table.signalId)]);

export const clientOpportunities = sqliteTable('client_opportunities', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), triggerJobId: text('trigger_job_id').references(() => jobs.id), status: text('status').notNull().default('DISCOVERED'),
  recommendedAction: text('recommended_action').notNull(), initialScore: integer('initial_score'), currentScore: integer('current_score').notNull(), discoveredAt: text('discovered_at').notNull(), lastActivityAt: text('last_activity_at').notNull(), ...timestamps
}, (table) => [uniqueIndex('idx_client_opportunities_trigger').on(table.companyId, table.triggerJobId), index('idx_client_opportunities_status_score').on(table.status, table.currentScore)]);

export const jobOpportunities = sqliteTable('job_opportunities', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id), status: text('status').notNull().default('DISCOVERED'), recommendedAction: text('recommended_action').notNull(),
  initialScore: integer('initial_score'), currentScore: integer('current_score').notNull(), discoveredAt: text('discovered_at').notNull(), lastActivityAt: text('last_activity_at').notNull(), ...timestamps
}, (table) => [uniqueIndex('idx_job_opportunities_job').on(table.jobId), index('idx_job_opportunities_status_score').on(table.status, table.currentScore)]);

export const clientScores = sqliteTable('client_scores', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), total: integer('total').notNull(), componentsJson: text('components_json').notNull(), reasonsJson: text('reasons_json').notNull(), modelVersion: text('model_version').notNull(), createdAt: text('created_at').notNull()
}, (table) => [index('idx_client_scores_opportunity_created').on(table.opportunityId, table.createdAt)]);

export const jobScores = sqliteTable('job_scores', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => jobOpportunities.id), total: integer('total').notNull(), componentsJson: text('components_json').notNull(), reasonsJson: text('reasons_json').notNull(), modelVersion: text('model_version').notNull(), createdAt: text('created_at').notNull()
}, (table) => [index('idx_job_scores_opportunity_created').on(table.opportunityId, table.createdAt)]);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(), entityType: text('entity_type').notNull(), entityId: text('entity_id').notNull(), type: text('type').notNull(), actor: text('actor').notNull().default('SYSTEM'),
  fromStatus: text('from_status'), toStatus: text('to_status'), metadataJson: text('metadata_json').notNull().default('{}'), occurredAt: text('occurred_at').notNull(), createdAt: text('created_at').notNull()
}, (table) => [index('idx_activities_entity_time').on(table.entityType, table.entityId, table.occurredAt), index('idx_activities_type_time').on(table.type, table.occurredAt)]);

export const conversionEvents = sqliteTable('conversion_events', {
  id: text('id').primaryKey(), funnel: text('funnel').notNull(), opportunityId: text('opportunity_id').notNull(), stage: text('stage').notNull(), sourceId: text('source_id').references(() => sources.id),
  campaignId: text('campaign_id'), revenueCents: integer('revenue_cents'), currency: text('currency').default('USD'), metadataJson: text('metadata_json').notNull().default('{}'), occurredAt: text('occurred_at').notNull(), createdAt: text('created_at').notNull()
}, (table) => [index('idx_conversion_funnel_stage_time').on(table.funnel, table.stage, table.occurredAt), index('idx_conversion_source_stage').on(table.sourceId, table.stage)]);

export const workerJobs = sqliteTable('worker_jobs', {
  id: text('id').primaryKey(), type: text('type').notNull(), payloadJson: text('payload_json').notNull(), status: text('status').notNull().default('PENDING'), priority: integer('priority').notNull().default(0),
  attempts: integer('attempts').notNull().default(0), maxAttempts: integer('max_attempts').notNull().default(3), runAfter: text('run_after').notNull(), idempotencyKey: text('idempotency_key'),
  createdAt: text('created_at').notNull(), startedAt: text('started_at'), finishedAt: text('finished_at'), errorJson: text('error_json'), resultJson: text('result_json'), lockedBy: text('locked_by')
}, (table) => [uniqueIndex('idx_worker_jobs_idempotency').on(table.idempotencyKey), index('idx_worker_jobs_claim').on(table.status, table.runAfter, table.priority)]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), valueJson: text('value_json').notNull(), updatedAt: text('updated_at').notNull()
});

export const companyResearchRuns = sqliteTable('company_research_runs', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), status: text('status').notNull(), trigger: text('trigger').notNull(), priority: integer('priority').notNull(),
  forceRefresh: integer('force_refresh', { mode: 'boolean' }).notNull().default(false), startedAt: text('started_at'), completedAt: text('completed_at'), pagesAttempted: integer('pages_attempted').notNull().default(0),
  pagesFetched: integer('pages_fetched').notNull().default(0), pagesReused: integer('pages_reused').notNull().default(0), evidenceCount: integer('evidence_count').notNull().default(0), signalCount: integer('signal_count').notNull().default(0),
  deterministicComplete: integer('deterministic_complete', { mode: 'boolean' }).notNull().default(false), aiStatus: text('ai_status').notNull().default('NOT_ATTEMPTED'), researchConfidence: real('research_confidence'), errorJson: text('error_json'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_research_runs_company_created').on(table.companyId, table.createdAt), index('idx_research_runs_status_priority').on(table.status, table.priority)]);

export const domainResolutions = sqliteTable('domain_resolutions', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), researchRunId: text('research_run_id').notNull().references(() => companyResearchRuns.id),
  candidateDomain: text('candidate_domain'), method: text('method').notNull(), confidence: real('confidence').notNull(), evidenceUrl: text('evidence_url'), accepted: integer('accepted', { mode: 'boolean' }).notNull(), resolvedAt: text('resolved_at').notNull(), createdAt: text('created_at').notNull()
}, (table) => [index('idx_domain_resolutions_company_time').on(table.companyId, table.resolvedAt), index('idx_domain_resolutions_run').on(table.researchRunId)]);

export const companyPages = sqliteTable('company_pages', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), url: text('url').notNull(), canonicalUrl: text('canonical_url').notNull(), pageType: text('page_type').notNull(),
  currentVersionId: text('current_version_id'), firstFetchedAt: text('first_fetched_at').notNull(), lastFetchedAt: text('last_fetched_at').notNull(), expiresAt: text('expires_at').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_company_pages_canonical').on(table.companyId, table.canonicalUrl), index('idx_company_pages_expiry').on(table.companyId, table.expiresAt)]);

export const companyPageVersions = sqliteTable('company_page_versions', {
  id: text('id').primaryKey(), pageId: text('page_id').notNull().references(() => companyPages.id), httpStatus: integer('http_status'), contentType: text('content_type'), title: text('title'), metaDescription: text('meta_description'),
  textContent: text('text_content'), headingsJson: text('headings_json').notNull().default('[]'), linksJson: text('links_json').notNull().default('[]'), emailsJson: text('emails_json').notNull().default('[]'), socialUrlsJson: text('social_urls_json').notNull().default('[]'), structuredDataJson: text('structured_data_json').notNull().default('[]'),
  contentHash: text('content_hash'), fetchedAt: text('fetched_at').notNull(), fetchDurationMs: integer('fetch_duration_ms').notNull(), source: text('source').notNull().default('HTTP'), errorJson: text('error_json'), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_page_versions_hash').on(table.pageId, table.contentHash), index('idx_page_versions_fetched').on(table.pageId, table.fetchedAt)]);

export const researchRunPages = sqliteTable('research_run_pages', {
  id: text('id').primaryKey(), researchRunId: text('research_run_id').notNull().references(() => companyResearchRuns.id), pageId: text('page_id').notNull().references(() => companyPages.id),
  pageVersionId: text('page_version_id').references(() => companyPageVersions.id), outcome: text('outcome').notNull(), relevanceScore: integer('relevance_score').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_research_run_pages_identity').on(table.researchRunId, table.pageId), index('idx_research_run_pages_version').on(table.pageVersionId)]);

export const evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), researchRunId: text('research_run_id').notNull().references(() => companyResearchRuns.id), pageId: text('page_id').references(() => companyPages.id),
  type: text('type').notNull(), classification: text('classification').notNull(), claim: text('claim').notNull(), evidenceText: text('evidence_text').notNull(), sourceUrl: text('source_url').notNull(), sourceQuality: text('source_quality').notNull(),
  confidence: real('confidence').notNull(), extractor: text('extractor').notNull(), contentHash: text('content_hash').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_evidence_run_hash').on(table.researchRunId, table.contentHash), index('idx_evidence_company_type').on(table.companyId, table.type), index('idx_evidence_run').on(table.researchRunId)]);

export const evidenceSignals = sqliteTable('evidence_signals', {
  id: text('id').primaryKey(), signalId: text('signal_id').notNull().references(() => signals.id), evidenceId: text('evidence_id').notNull().references(() => evidence.id), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_evidence_signals_identity').on(table.signalId, table.evidenceId), index('idx_evidence_signals_evidence').on(table.evidenceId)]);

export const companyProfiles = sqliteTable('company_profiles', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), researchRunId: text('research_run_id').notNull().references(() => companyResearchRuns.id),
  summary: text('summary'), industry: text('industry'), businessModel: text('business_model'), stage: text('stage'), locationsJson: text('locations_json').notNull().default('[]'), productsJson: text('products_json').notNull().default('[]'), servicesJson: text('services_json').notNull().default('[]'),
  customerTypesJson: text('customer_types_json').notNull().default('[]'), technicalFocusJson: text('technical_focus_json').notNull().default('[]'), growthSignalsJson: text('growth_signals_json').notNull().default('[]'), hiringSignalsJson: text('hiring_signals_json').notNull().default('[]'),
  aiRelevance: real('ai_relevance').notNull(), engineeringNeed: real('engineering_need').notNull(), contactability: real('contactability').notNull(), researchConfidence: real('research_confidence').notNull(),
  whatIsHappening: text('what_is_happening').notNull(), whyItMatters: text('why_it_matters').notNull(), whyMatch: text('why_match').notNull(), recommendedNextStep: text('recommended_next_step').notNull(),
  aiAnalysisJson: text('ai_analysis_json'), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_company_profiles_run').on(table.researchRunId), index('idx_company_profiles_company_created').on(table.companyId, table.createdAt)]);

export const aiRuns = sqliteTable('ai_runs', {
  id: text('id').primaryKey(), companyId: text('company_id').references(() => companies.id), researchRunId: text('research_run_id').references(() => companyResearchRuns.id), task: text('task').notNull(), provider: text('provider').notNull(), model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(), inputHash: text('input_hash').notNull(), inputJson: text('input_json').notNull(), outputJson: text('output_json'), status: text('status').notNull(), latencyMs: integer('latency_ms').notNull(), promptTokens: integer('prompt_tokens'), completionTokens: integer('completion_tokens'),
  errorJson: text('error_json'), entityType:text('entity_type'), entityId:text('entity_id'), expiresAt:text('expires_at'), createdAt: text('created_at').notNull()
}, (table) => [index('idx_ai_runs_company_task').on(table.companyId, table.task, table.createdAt), index('idx_ai_runs_input').on(table.task, table.inputHash, table.status)]);

export const contactResearchRuns = sqliteTable('contact_research_runs', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), status: text('status').notNull(), trigger: text('trigger').notNull(), priority: integer('priority').notNull(),
  forceRefresh: integer('force_refresh', { mode: 'boolean' }).notNull().default(false), peopleFound: integer('people_found').notNull().default(0), contactsFound: integer('contacts_found').notNull().default(0),
  startedAt: text('started_at'), completedAt: text('completed_at'), errorJson: text('error_json'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_contact_runs_company_created').on(table.companyId, table.createdAt), index('idx_contact_runs_status_priority').on(table.status, table.priority)]);

export const people = sqliteTable('people', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), fullName: text('full_name').notNull(), normalizedName: text('normalized_name').notNull(), firstName: text('first_name').notNull(), lastName: text('last_name').notNull(),
  title: text('title').notNull(), normalizedTitle: text('normalized_title').notNull(), department: text('department').notNull(), seniority: text('seniority').notNull(), decisionMakerScore: integer('decision_maker_score').notNull().default(0),
  decisionMakerReason: text('decision_maker_reason'), confidence: real('confidence').notNull(), linkedinUrl: text('linkedin_url'), githubUrl: text('github_url'), firstDiscoveredAt: text('first_discovered_at').notNull(), lastVerifiedAt: text('last_verified_at').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_people_company_name').on(table.companyId, table.normalizedName), index('idx_people_company_rank').on(table.companyId, table.decisionMakerScore)]);

export const personSources = sqliteTable('person_sources', {
  id: text('id').primaryKey(), personId: text('person_id').notNull().references(() => people.id), contactResearchRunId: text('contact_research_run_id').notNull().references(() => contactResearchRuns.id), pageId: text('page_id').references(() => companyPages.id),
  sourceUrl: text('source_url').notNull(), sourceType: text('source_type').notNull(), contentHash: text('content_hash').notNull(), firstSeenAt: text('first_seen_at').notNull(), lastSeenAt: text('last_seen_at').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_person_sources_identity').on(table.personId, table.contactResearchRunId, table.sourceUrl, table.contentHash), index('idx_person_sources_run').on(table.contactResearchRunId)]);

export const personEvidence = sqliteTable('person_evidence', {
  id: text('id').primaryKey(), personId: text('person_id').notNull().references(() => people.id), contactResearchRunId: text('contact_research_run_id').notNull().references(() => contactResearchRuns.id), pageId: text('page_id').references(() => companyPages.id),
  claim: text('claim').notNull(), evidenceText: text('evidence_text').notNull(), sourceUrl: text('source_url').notNull(), sourceQuality: text('source_quality').notNull(), confidence: real('confidence').notNull(), contentHash: text('content_hash').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_person_evidence_identity').on(table.personId, table.contactResearchRunId, table.contentHash), index('idx_person_evidence_run').on(table.contactResearchRunId)]);

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), personId: text('person_id').references(() => people.id), type: text('type').notNull(), contactValue: text('contact_value').notNull(), normalizedValue: text('normalized_value').notNull(),
  status: text('status').notNull(), confidence: integer('confidence').notNull(), patternUsed: text('pattern_used'), firstDiscoveredAt: text('first_discovered_at').notNull(), lastCheckedAt: text('last_checked_at').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_contacts_company_value').on(table.companyId, table.normalizedValue), index('idx_contacts_person_confidence').on(table.personId, table.confidence)]);

export const contactSources = sqliteTable('contact_sources', {
  id: text('id').primaryKey(), contactId: text('contact_id').notNull().references(() => contacts.id), contactResearchRunId: text('contact_research_run_id').notNull().references(() => contactResearchRuns.id), pageId: text('page_id').references(() => companyPages.id),
  sourceUrl: text('source_url').notNull(), sourceType: text('source_type').notNull(), contentHash: text('content_hash').notNull(), firstSeenAt: text('first_seen_at').notNull(), lastSeenAt: text('last_seen_at').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_contact_sources_identity').on(table.contactId, table.contactResearchRunId, table.sourceUrl, table.contentHash), index('idx_contact_sources_run').on(table.contactResearchRunId)]);

export const emailPatterns = sqliteTable('email_patterns', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), contactResearchRunId: text('contact_research_run_id').notNull().references(() => contactResearchRuns.id), domain: text('domain').notNull(), pattern: text('pattern').notNull(),
  evidenceEmailsJson: text('evidence_emails_json').notNull(), confidence: real('confidence').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull()
}, (table) => [index('idx_email_patterns_company_created').on(table.companyId, table.createdAt), uniqueIndex('idx_email_patterns_run_pattern').on(table.contactResearchRunId, table.pattern)]);

export const contactValidations = sqliteTable('contact_validations', {
  id: text('id').primaryKey(), contactId: text('contact_id').notNull().references(() => contacts.id), syntaxValid: integer('syntax_valid', { mode: 'boolean' }).notNull(), domainMatches: integer('domain_matches', { mode: 'boolean' }).notNull(), disposable: integer('disposable', { mode: 'boolean' }).notNull(),
  dnsStatus: text('dns_status').notNull(), mxStatus: text('mx_status').notNull(), mxHostsJson: text('mx_hosts_json').notNull().default('[]'), checkedAt: text('checked_at').notNull(), expiresAt: text('expires_at').notNull(), errorJson: text('error_json'), createdAt: text('created_at').notNull()
}, (table) => [index('idx_contact_validations_contact_checked').on(table.contactId, table.checkedAt)]);

export const dnsCache = sqliteTable('dns_cache', {
  domain: text('domain').primaryKey(), dnsStatus: text('dns_status').notNull(), mxStatus: text('mx_status').notNull(), mxHostsJson: text('mx_hosts_json').notNull().default('[]'), checkedAt: text('checked_at').notNull(), expiresAt: text('expires_at').notNull(), errorJson: text('error_json'), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_dns_cache_expires').on(table.expiresAt)]);

export const decisionMakerSelections = sqliteTable('decision_maker_selections', {
  id: text('id').primaryKey(), companyId: text('company_id').notNull().references(() => companies.id), contactResearchRunId: text('contact_research_run_id').references(() => contactResearchRuns.id), primaryPersonId: text('primary_person_id').notNull().references(() => people.id), secondaryPersonId: text('secondary_person_id').references(() => people.id),
  score: integer('score').notNull(), reason: text('reason').notNull(), confidence: real('confidence').notNull(), selectedBy: text('selected_by').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull()
}, (table) => [index('idx_decision_makers_company_active').on(table.companyId, table.active, table.createdAt), index('idx_decision_makers_primary').on(table.primaryPersonId)]);

// Operational GTM records are append-only where content or outcomes can affect later analytics.
export const services = sqliteTable('services', {
  id: text('id').primaryKey(), slug: text('slug').notNull(), name: text('name').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true), configJson: text('config_json').notNull().default('{}'), ...timestamps
}, (table) => [uniqueIndex('idx_services_slug').on(table.slug)]);

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(), name: text('name').notNull(), status: text('status').notNull().default('DRAFT'), primaryServiceId: text('primary_service_id').references(() => services.id), targetingJson: text('targeting_json').notNull().default('{}'), messageStrategy: text('message_strategy'), ...timestamps
}, (table) => [index('idx_campaigns_status').on(table.status)]);

export const serviceMatches = sqliteTable('service_matches', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), companyId: text('company_id').notNull().references(() => companies.id), primaryServiceId: text('primary_service_id').notNull().references(() => services.id), secondaryServiceId: text('secondary_service_id').references(() => services.id), confidence: real('confidence').notNull(), reason: text('reason').notNull(), evidenceIdsJson: text('evidence_ids_json').notNull().default('[]'), inputHash: text('input_hash').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_service_matches_input').on(table.opportunityId, table.inputHash), index('idx_service_matches_company').on(table.companyId, table.createdAt)]);

export const outreachStrategies = sqliteTable('outreach_strategies', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), companyId: text('company_id').notNull().references(() => companies.id), personId: text('person_id').notNull().references(() => people.id), contactId: text('contact_id').references(() => contacts.id), serviceMatchId: text('service_match_id').notNull().references(() => serviceMatches.id), primarySignal: text('primary_signal').notNull(), angle: text('angle').notNull(), cta: text('cta').notNull(), confidence: real('confidence').notNull(), evidenceHash: text('evidence_hash').notNull(), promptVersion: text('prompt_version').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_outreach_strategy_inputs').on(table.opportunityId, table.personId, table.serviceMatchId, table.evidenceHash, table.promptVersion)]);

export const outreachMessages = sqliteTable('outreach_messages', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), strategyId: text('strategy_id').notNull().references(() => outreachStrategies.id), campaignId: text('campaign_id').references(() => campaigns.id), channel: text('channel').notNull(), followupNumber: integer('followup_number').notNull().default(0), status: text('status').notNull().default('DRAFT'), currentVersionId: text('current_version_id'), staleReason: text('stale_reason'), approvedAt: text('approved_at'), sentAt: text('sent_at'), ...timestamps
}, (table) => [index('idx_outreach_messages_queue').on(table.status, table.createdAt), uniqueIndex('idx_outreach_message_strategy_step').on(table.strategyId, table.channel, table.followupNumber)]);

export const outreachMessageVersions = sqliteTable('outreach_message_versions', {
  id: text('id').primaryKey(), messageId: text('message_id').notNull().references(() => outreachMessages.id), version: integer('version').notNull(), parentVersionId: text('parent_version_id'), subjectsJson: text('subjects_json').notNull().default('[]'), textBody: text('text_body').notNull(), htmlBody: text('html_body'), createdBy: text('created_by').notNull(), status: text('status').notNull(), promptVersion: text('prompt_version').notNull(), evidenceHash: text('evidence_hash').notNull(), metadataJson: text('metadata_json').notNull().default('{}'), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_outreach_versions_number').on(table.messageId, table.version), index('idx_outreach_versions_created').on(table.messageId, table.createdAt)]);

export const outreachMessageEvidence = sqliteTable('outreach_message_evidence', {
  id: text('id').primaryKey(), messageVersionId: text('message_version_id').notNull().references(() => outreachMessageVersions.id), evidenceId: text('evidence_id').notNull().references(() => evidence.id), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_outreach_message_evidence_identity').on(table.messageVersionId, table.evidenceId)]);

export const campaignMembers = sqliteTable('campaign_members', {
  id: text('id').primaryKey(), campaignId: text('campaign_id').notNull().references(() => campaigns.id), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), personId: text('person_id').references(() => people.id), serviceMatchId: text('service_match_id').references(() => serviceMatches.id), channel: text('channel').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_campaign_members_identity').on(table.campaignId, table.opportunityId, table.channel)]);

export const emailThreads = sqliteTable('email_threads', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').references(() => clientOpportunities.id), personId: text('person_id').references(() => people.id), contactId: text('contact_id').references(() => contacts.id), campaignId: text('campaign_id').references(() => campaigns.id), subject: text('subject').notNull(), normalizedSubject: text('normalized_subject').notNull(), providerThreadId: text('provider_thread_id'), status: text('status').notNull().default('OPEN'), lastMessageAt: text('last_message_at').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_email_threads_opportunity').on(table.opportunityId, table.lastMessageAt), index('idx_email_threads_subject').on(table.normalizedSubject)]);

export const emailMessages = sqliteTable('email_messages', {
  id: text('id').primaryKey(), threadId: text('thread_id').notNull().references(() => emailThreads.id), outreachMessageId: text('outreach_message_id').references(() => outreachMessages.id), direction: text('direction').notNull(), messageId: text('message_id'), inReplyTo: text('in_reply_to'), referencesJson: text('references_json').notNull().default('[]'), sender: text('sender').notNull(), recipientsJson: text('recipients_json').notNull(), subject: text('subject').notNull(), textBody: text('text_body').notNull(), htmlBody: text('html_body'), rawMetadataJson: text('raw_metadata_json').notNull().default('{}'), occurredAt: text('occurred_at').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_email_messages_message_id').on(table.messageId), index('idx_email_messages_thread').on(table.threadId, table.occurredAt)]);

export const emailSendAttempts = sqliteTable('email_send_attempts', {
  id: text('id').primaryKey(), outreachMessageId: text('outreach_message_id').notNull().references(() => outreachMessages.id), messageVersionId: text('message_version_id').notNull().references(() => outreachMessageVersions.id), recipient: text('recipient').notNull(), idempotencyKey: text('idempotency_key').notNull(), status: text('status').notNull(), providerMessageId: text('provider_message_id'), providerResponseJson: text('provider_response_json'), errorJson: text('error_json'), attempts: integer('attempts').notNull().default(0), startedAt: text('started_at').notNull(), completedAt: text('completed_at'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_email_send_idempotency').on(table.idempotencyKey), index('idx_email_send_limits').on(table.status, table.completedAt)]);

export const followupSequences = sqliteTable('followup_sequences', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), threadId: text('thread_id').references(() => emailThreads.id), status: text('status').notNull(), approvalMode: text('approval_mode').notNull().default('MANUAL_APPROVAL'), nextDueAt: text('next_due_at'), stopReason: text('stop_reason'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_followup_sequences_due').on(table.status, table.nextDueAt), index('idx_followup_sequences_opportunity').on(table.opportunityId)]);

export const followupSteps = sqliteTable('followup_steps', {
  id: text('id').primaryKey(), sequenceId: text('sequence_id').notNull().references(() => followupSequences.id), outreachMessageId: text('outreach_message_id').notNull().references(() => outreachMessages.id), stepNumber: integer('step_number').notNull(), dueAt: text('due_at').notNull(), status: text('status').notNull(), approvedAt: text('approved_at'), sentAt: text('sent_at'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_followup_steps_identity').on(table.sequenceId, table.stepNumber), index('idx_followup_steps_due').on(table.status, table.dueAt)]);

export const suppressionList = sqliteTable('suppression_list', {
  id: text('id').primaryKey(), contactValue: text('contact_value').notNull(), normalizedValue: text('normalized_value').notNull(), reason: text('reason').notNull(), sourceEntityId: text('source_entity_id'), active: integer('active', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull(), liftedAt: text('lifted_at')
}, (table) => [index('idx_suppression_lookup').on(table.normalizedValue, table.active)]);

export const inboundCheckpoints = sqliteTable('inbound_checkpoints', {
  id: text('id').primaryKey(), provider: text('provider').notNull(), mailbox: text('mailbox').notNull(), uidValidity: text('uid_validity'), lastUid: integer('last_uid').notNull().default(0), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_inbound_checkpoint_mailbox').on(table.provider, table.mailbox)]);

export const replyClassifications = sqliteTable('reply_classifications', {
  id: text('id').primaryKey(), emailMessageId: text('email_message_id').notNull().references(() => emailMessages.id), classification: text('classification').notNull(), confidence: real('confidence').notNull(), reason: text('reason').notNull(), classifier: text('classifier').notNull(), model: text('model'), promptVersion: text('prompt_version'), createdAt: text('created_at').notNull()
}, (table) => [index('idx_reply_classifications_message').on(table.emailMessageId, table.createdAt), index('idx_reply_classifications_type').on(table.classification, table.createdAt)]);

export const candidateProfiles = sqliteTable('candidate_profiles', {
  id: text('id').primaryKey(), version: integer('version').notNull(), name: text('name').notNull(), professionalTitle: text('professional_title').notNull(), summary: text('summary').notNull(), skillsJson: text('skills_json').notNull(), technologiesJson: text('technologies_json').notNull(), experienceJson: text('experience_json').notNull(), portfolioUrl: text('portfolio_url'), githubUrl: text('github_url'), linkedinUrl: text('linkedin_url'), preferencesJson: text('preferences_json').notNull(), inputHash: text('input_hash').notNull(), active: integer('active', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_candidate_profile_hash').on(table.inputHash), index('idx_candidate_profile_active').on(table.active, table.version)]);

export const candidateProjects = sqliteTable('candidate_projects', {
  id: text('id').primaryKey(), candidateProfileId: text('candidate_profile_id').notNull().references(() => candidateProfiles.id), name: text('name').notNull(), description: text('description').notNull(), problem: text('problem'), solution: text('solution'), technologiesJson: text('technologies_json').notNull(), aiCapabilitiesJson: text('ai_capabilities_json').notNull().default('[]'), industry: text('industry'), url: text('url'), repositoryUrl: text('repository_url'), results: text('results'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_candidate_projects_profile').on(table.candidateProfileId)]);

export const resumeVersions = sqliteTable('resume_versions', {
  id: text('id').primaryKey(), candidateProfileId: text('candidate_profile_id').notNull().references(() => candidateProfiles.id), name: text('name').notNull(), version: integer('version').notNull(), contentText: text('content_text'), filePath: text('file_path'), skillsJson: text('skills_json').notNull().default('[]'), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_resume_versions_name').on(table.candidateProfileId, table.name, table.version)]);

export const applicationPackages = sqliteTable('application_packages', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => jobOpportunities.id), candidateProfileId: text('candidate_profile_id').notNull().references(() => candidateProfiles.id), candidateProfileHash: text('candidate_profile_hash').notNull(), jobHash: text('job_hash').notNull(), status: text('status').notNull(), matchScore: integer('match_score').notNull(), matchJson: text('match_json').notNull(), currentVersionId: text('current_version_id'), promptVersion: text('prompt_version').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [uniqueIndex('idx_application_packages_inputs').on(table.opportunityId, table.candidateProfileHash, table.jobHash, table.promptVersion), index('idx_application_packages_status').on(table.status, table.createdAt)]);

export const applicationMaterialVersions = sqliteTable('application_material_versions', {
  id: text('id').primaryKey(), packageId: text('package_id').notNull().references(() => applicationPackages.id), version: integer('version').notNull(), parentVersionId: text('parent_version_id'), materialsJson: text('materials_json').notNull(), createdBy: text('created_by').notNull(), status: text('status').notNull(), createdAt: text('created_at').notNull()
}, (table) => [uniqueIndex('idx_application_material_versions_number').on(table.packageId, table.version)]);

export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => jobOpportunities.id), packageId: text('package_id').references(() => applicationPackages.id), applicationUrl: text('application_url').notNull(), source: text('source').notNull(), resumeVersionId: text('resume_version_id').references(() => resumeVersions.id), coverLetterVersionId: text('cover_letter_version_id').references(() => applicationMaterialVersions.id), status: text('status').notNull(), appliedAt: text('applied_at'), notes: text('notes'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_applications_opportunity').on(table.opportunityId, table.createdAt), index('idx_applications_status').on(table.status, table.updatedAt)]);

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(), type: text('type').notNull(), entityType: text('entity_type').notNull(), entityId: text('entity_id').notNull(), priority: integer('priority').notNull(), dueAt: text('due_at'), status: text('status').notNull().default('OPEN'), completedAt: text('completed_at'), metadataJson: text('metadata_json').notNull().default('{}'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_tasks_action_center').on(table.status, table.dueAt, table.priority), index('idx_tasks_entity').on(table.entityType, table.entityId)]);

export const deals = sqliteTable('deals', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => clientOpportunities.id), serviceId: text('service_id').references(() => services.id), campaignId: text('campaign_id').references(() => campaigns.id), personId: text('person_id').references(() => people.id), sourceId: text('source_id').references(() => sources.id), valueCents: integer('value_cents'), currency: text('currency').notNull().default('USD'), status: text('status').notNull(), wonAt: text('won_at'), notes: text('notes'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, (table) => [index('idx_deals_opportunity').on(table.opportunityId, table.createdAt), index('idx_deals_status_won').on(table.status, table.wonAt)]);

export const modelSnapshots = sqliteTable('model_snapshots', {
  id:text('id').primaryKey(), funnel:text('funnel').notNull(), target:text('target').notNull(), modelVersion:text('model_version').notNull(), featureVersion:text('feature_version').notNull(), trainingWindowStart:text('training_window_start'), trainingWindowEnd:text('training_window_end').notNull(), sampleSize:integer('sample_size').notNull(), positiveCount:integer('positive_count').notNull(), featureListJson:text('feature_list_json').notNull(), coefficientsJson:text('coefficients_json'), metricsJson:text('metrics_json').notNull(), calibrationStatus:text('calibration_status').notNull(), status:text('status').notNull(), createdAt:text('created_at').notNull()
}, table=>[index('idx_model_snapshots_target').on(table.funnel,table.target,table.createdAt)]);

export const modelPredictions = sqliteTable('model_predictions', {
  id:text('id').primaryKey(), modelSnapshotId:text('model_snapshot_id').notNull().references(()=>modelSnapshots.id), funnel:text('funnel').notNull(), opportunityId:text('opportunity_id').notNull(), target:text('target').notNull(), probability:real('probability'), confidenceBand:text('confidence_band').notNull(), explanationJson:text('explanation_json').notNull(), createdAt:text('created_at').notNull()
}, table=>[uniqueIndex('idx_model_predictions_identity').on(table.modelSnapshotId,table.opportunityId),index('idx_model_predictions_opportunity').on(table.funnel,table.opportunityId,table.createdAt)]);

export const learningRecommendations = sqliteTable('learning_recommendations', {
  id:text('id').primaryKey(), type:text('type').notNull(), funnel:text('funnel').notNull(), feature:text('feature').notNull(), currentWeight:real('current_weight'), suggestedWeight:real('suggested_weight'), reason:text('reason').notNull(), sampleSize:integer('sample_size').notNull(), successCount:integer('success_count').notNull(), rate:real('rate').notNull(), baselineRate:real('baseline_rate').notNull(), reliability:text('reliability').notNull(), status:text('status').notNull().default('PENDING'), decidedAt:text('decided_at'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
}, table=>[index('idx_learning_recommendations_status').on(table.status,table.createdAt),uniqueIndex('idx_learning_recommendations_feature').on(table.type,table.funnel,table.feature,table.createdAt)]);

export const schedulerLeases = sqliteTable('scheduler_leases', {
  key:text('key').primaryKey(), lastRunAt:text('last_run_at'), nextRunAt:text('next_run_at').notNull(), lockedAt:text('locked_at'), lockedBy:text('locked_by'), updatedAt:text('updated_at').notNull()
}, table=>[index('idx_scheduler_due').on(table.nextRunAt)]);

export const backupHistory = sqliteTable('backup_history', {
  id:text('id').primaryKey(), path:text('path').notNull(), sizeBytes:integer('size_bytes'), status:text('status').notNull(), errorJson:text('error_json'), createdAt:text('created_at').notNull(), completedAt:text('completed_at')
}, table=>[index('idx_backup_history_created').on(table.createdAt)]);

// Northstar Academic Intelligence is deliberately isolated from the GTM funnels.
// Generic worker_jobs and activities remain shared infrastructure.
export const academicApplicantProfiles = sqliteTable('academic_applicant_profiles', {
  id:text('id').primaryKey(), name:text('name').notNull(), nationality:text('nationality').notNull(), location:text('location').notNull(),
  educationJson:text('education_json').notNull().default('[]'), manuscriptsJson:text('manuscripts_json').notNull().default('[]'), backgroundJson:text('background_json').notNull().default('{}'),
  primaryInterestsJson:text('primary_interests_json').notNull().default('[]'), secondaryInterestsJson:text('secondary_interests_json').notNull().default('[]'), countryPrioritiesJson:text('country_priorities_json').notNull().default('{}'),
  active:integer('active',{mode:'boolean'}).notNull().default(true), ...timestamps
}, table=>[index('idx_academic_profiles_active').on(table.active)]);

export const universities = sqliteTable('universities', {
  id:text('id').primaryKey(), canonicalName:text('canonical_name').notNull(), normalizedName:text('normalized_name').notNull(), country:text('country').notNull(), city:text('city'), officialUrl:text('official_url'), admissionsUrl:text('admissions_url'), graduateAdmissionsUrl:text('graduate_admissions_url'),
  tuitionModel:text('tuition_model').notNull().default('UNKNOWN'), applicationFee:text('application_fee'), fundingSummary:text('funding_summary'), englishRequirements:text('english_requirements'), greRequirements:text('gre_requirements'), gpaRequirements:text('gpa_requirements'), degreePrerequisites:text('degree_prerequisites'),
  internationalEligibility:text('international_eligibility').notNull().default('UNKNOWN'), pakistaniEligibility:text('pakistani_eligibility').notNull().default('UNKNOWN'), confidence:real('confidence').notNull().default(0), firstDiscoveredAt:text('first_discovered_at').notNull(), lastVerifiedAt:text('last_verified_at'), ...timestamps
}, table=>[uniqueIndex('idx_universities_identity').on(table.normalizedName,table.country),index('idx_universities_country').on(table.country)]);

export const academicDepartments = sqliteTable('academic_departments', {
  id:text('id').primaryKey(), universityId:text('university_id').notNull().references(()=>universities.id), name:text('name').notNull(), normalizedName:text('normalized_name').notNull(), websiteUrl:text('website_url'), ...timestamps
}, table=>[uniqueIndex('idx_academic_departments_identity').on(table.universityId,table.normalizedName)]);

export const academicPrograms = sqliteTable('academic_programs', {
  id:text('id').primaryKey(), universityId:text('university_id').notNull().references(()=>universities.id), departmentId:text('department_id').references(()=>academicDepartments.id), name:text('name').notNull(), normalizedName:text('normalized_name').notNull(), degreeLevel:text('degree_level').notNull(), websiteUrl:text('website_url'), applicationUrl:text('application_url'), duration:text('duration'), requirementsJson:text('requirements_json').notNull().default('{}'), contactProfessorPolicy:text('contact_professor_policy').notNull().default('UNKNOWN'), supervisorApprovalRequired:text('supervisor_approval_required').notNull().default('UNKNOWN'), directBachelorsToPhd:text('direct_bachelors_to_phd').notNull().default('UNKNOWN'), admissionsStatus:text('admissions_status').notNull().default('UNKNOWN'), ...timestamps
}, table=>[uniqueIndex('idx_academic_programs_identity').on(table.universityId,table.normalizedName,table.degreeLevel)]);

export const researchGroups = sqliteTable('research_groups', {
  id:text('id').primaryKey(), universityId:text('university_id').notNull().references(()=>universities.id), departmentId:text('department_id').references(()=>academicDepartments.id), name:text('name').notNull(), normalizedName:text('normalized_name').notNull(), websiteUrl:text('website_url'), focusJson:text('focus_json').notNull().default('[]'), ...timestamps
}, table=>[uniqueIndex('idx_research_groups_identity').on(table.universityId,table.normalizedName)]);

export const professors = sqliteTable('professors', {
  id:text('id').primaryKey(), universityId:text('university_id').notNull().references(()=>universities.id), departmentId:text('department_id').references(()=>academicDepartments.id), researchGroupId:text('research_group_id').references(()=>researchGroups.id), fullName:text('full_name').notNull(), normalizedName:text('normalized_name').notNull(), title:text('title'), officialProfileUrl:text('official_profile_url'), labUrl:text('lab_url'), scholarUrl:text('scholar_url'), orcid:text('orcid'), publicEmail:text('public_email'), contactJson:text('contact_json').notNull().default('{}'), researchAreasJson:text('research_areas_json').notNull().default('[]'), summary:text('summary'), recentWorksJson:text('recent_works_json').notNull().default('[]'), projectsJson:text('projects_json').notNull().default('[]'), grantsJson:text('grants_json').notNull().default('[]'), supervisionEvidence:text('supervision_evidence'), recruitingEvidence:text('recruiting_evidence'), openPositionsJson:text('open_positions_json').notNull().default('[]'), firstDiscoveredAt:text('first_discovered_at').notNull(), lastVerifiedAt:text('last_verified_at'), ...timestamps
}, table=>[uniqueIndex('idx_professors_identity').on(table.universityId,table.normalizedName),index('idx_professors_email').on(table.publicEmail)]);

export const academicSources = sqliteTable('academic_sources', {
  id:text('id').primaryKey(), kind:text('kind').notNull(), name:text('name').notNull(), url:text('url').notNull(), canonicalUrl:text('canonical_url').notNull(), entityType:text('entity_type'), entityId:text('entity_id'), official:integer('official',{mode:'boolean'}).notNull().default(false), enabled:integer('enabled',{mode:'boolean'}).notNull().default(true), refreshIntervalHours:integer('refresh_interval_hours').notNull().default(168), lastRetrievedAt:text('last_retrieved_at'), nextRefreshAt:text('next_refresh_at'), lastContentHash:text('last_content_hash'), lastStatus:text('last_status').notNull().default('NEW'), metadataJson:text('metadata_json').notNull().default('{}'), ...timestamps
}, table=>[uniqueIndex('idx_academic_sources_url').on(table.canonicalUrl),index('idx_academic_sources_refresh').on(table.enabled,table.nextRefreshAt)]);

export const academicResearchRuns = sqliteTable('academic_research_runs', {
  id:text('id').primaryKey(), sourceId:text('source_id').references(()=>academicSources.id), entityType:text('entity_type'), entityId:text('entity_id'), trigger:text('trigger').notNull(), status:text('status').notNull(), startedAt:text('started_at'), completedAt:text('completed_at'), changed:integer('changed',{mode:'boolean'}).notNull().default(false), errorJson:text('error_json'), ...timestamps
}, table=>[index('idx_academic_runs_entity').on(table.entityType,table.entityId,table.createdAt)]);

export const academicPageVersions = sqliteTable('academic_page_versions', {
  id:text('id').primaryKey(), sourceId:text('source_id').notNull().references(()=>academicSources.id), researchRunId:text('research_run_id').references(()=>academicResearchRuns.id), contentHash:text('content_hash').notNull(), title:text('title'), textContent:text('text_content').notNull(), httpStatus:integer('http_status'), retrievedAt:text('retrieved_at').notNull(), metadataJson:text('metadata_json').notNull().default('{}'), createdAt:text('created_at').notNull()
}, table=>[uniqueIndex('idx_academic_page_versions_hash').on(table.sourceId,table.contentHash),index('idx_academic_page_versions_time').on(table.sourceId,table.retrievedAt)]);

export const academicEvidence = sqliteTable('academic_evidence', {
  id:text('id').primaryKey(), sourceId:text('source_id').notNull().references(()=>academicSources.id), pageVersionId:text('page_version_id').references(()=>academicPageVersions.id), entityType:text('entity_type').notNull(), entityId:text('entity_id').notNull(), claimType:text('claim_type').notNull(), claim:text('claim').notNull(), excerpt:text('excerpt'), sourceUrl:text('source_url').notNull(), classification:text('classification').notNull().default('FACT'), confidence:real('confidence').notNull(), observedAt:text('observed_at').notNull(), createdAt:text('created_at').notNull()
}, table=>[index('idx_academic_evidence_entity').on(table.entityType,table.entityId,table.claimType),uniqueIndex('idx_academic_evidence_identity').on(table.entityType,table.entityId,table.claimType,table.sourceUrl,table.claim)]);

export const fundingOpportunities = sqliteTable('funding_opportunities', {
  id:text('id').primaryKey(), universityId:text('university_id').references(()=>universities.id), programId:text('program_id').references(()=>academicPrograms.id), name:text('name').notNull(), category:text('category').notNull().default('UNKNOWN'), tuitionCoverage:text('tuition_coverage'), stipendAmount:real('stipend_amount'), stipendCurrency:text('stipend_currency'), stipendPeriod:text('stipend_period'), accommodation:text('accommodation'), healthInsurance:text('health_insurance'), travel:text('travel'), researchAllowance:text('research_allowance'), assistantship:text('assistantship'), employmentContract:text('employment_contract'), duration:text('duration'), conditions:text('conditions'), officialSourceUrl:text('official_source_url'), deadline:text('deadline'), ...timestamps
}, table=>[index('idx_funding_category').on(table.category),index('idx_funding_deadline').on(table.deadline)]);

export const scholarships = sqliteTable('scholarships', {
  id:text('id').primaryKey(), fundingOpportunityId:text('funding_opportunity_id').notNull().references(()=>fundingOpportunities.id), provider:text('provider'), countriesJson:text('countries_json').notNull().default('[]'), citizenshipRestrictions:text('citizenship_restrictions'), ageRestrictions:text('age_restrictions'), applicationUrl:text('application_url'), ...timestamps
});

export const academicOpportunities = sqliteTable('academic_opportunities', {
  id:text('id').primaryKey(), universityId:text('university_id').notNull().references(()=>universities.id), programId:text('program_id').references(()=>academicPrograms.id), fundingOpportunityId:text('funding_opportunity_id').references(()=>fundingOpportunities.id), title:text('title').notNull(), normalizedTitle:text('normalized_title').notNull(), degreeLevel:text('degree_level').notNull(), country:text('country').notNull(), deadline:text('deadline'), status:text('status').notNull().default('DISCOVERED'), fundingCategory:text('funding_category').notNull().default('UNKNOWN'), eligibilityStatus:text('eligibility_status').notNull().default('UNKNOWN'), currentScore:integer('current_score').notNull().default(0), sourceUrl:text('source_url'), researchFreshness:text('research_freshness').notNull().default('UNKNOWN'), notes:text('notes'), firstDiscoveredAt:text('first_discovered_at').notNull(), lastVerifiedAt:text('last_verified_at'), ...timestamps
}, table=>[uniqueIndex('idx_academic_opportunity_identity').on(table.universityId,table.normalizedTitle,table.degreeLevel),index('idx_academic_opportunity_rank').on(table.status,table.currentScore)]);

export const professorCases = sqliteTable('professor_cases', {
  id:text('id').primaryKey(), professorId:text('professor_id').notNull().references(()=>professors.id), opportunityId:text('opportunity_id').references(()=>academicOpportunities.id), status:text('status').notNull().default('RESEARCHING'), matchSummary:text('match_summary'), matchingSkillsJson:text('matching_skills_json').notNull().default('[]'), matchingInterestsJson:text('matching_interests_json').notNull().default('[]'), matchingExperienceJson:text('matching_experience_json').notNull().default('[]'), researchIdeasJson:text('research_ideas_json').notNull().default('[]'), weaknessesJson:text('weaknesses_json').notNull().default('[]'), matchConfidence:real('match_confidence').notNull().default(0), notes:text('notes'), ...timestamps
}, table=>[uniqueIndex('idx_professor_cases_identity').on(table.professorId,table.opportunityId),index('idx_professor_cases_status').on(table.status)]);

export const eligibilityChecks = sqliteTable('eligibility_checks', {
  id:text('id').primaryKey(), opportunityId:text('opportunity_id').notNull().references(()=>academicOpportunities.id), applicantProfileId:text('applicant_profile_id').notNull().references(()=>academicApplicantProfiles.id), status:text('status').notNull(), criteriaJson:text('criteria_json').notNull(), reasonsJson:text('reasons_json').notNull(), evidenceIdsJson:text('evidence_ids_json').notNull().default('[]'), rulesVersion:text('rules_version').notNull(), createdAt:text('created_at').notNull()
}, table=>[index('idx_eligibility_opportunity_time').on(table.opportunityId,table.createdAt)]);

export const academicScoreSnapshots = sqliteTable('academic_score_snapshots', {
  id:text('id').primaryKey(), opportunityId:text('opportunity_id').notNull().references(()=>academicOpportunities.id), total:integer('total').notNull(), componentsJson:text('components_json').notNull(), explanationsJson:text('explanations_json').notNull(), evidenceIdsJson:text('evidence_ids_json').notNull().default('[]'), modelVersion:text('model_version').notNull(), createdAt:text('created_at').notNull()
}, table=>[index('idx_academic_scores_opportunity_time').on(table.opportunityId,table.createdAt)]);

export const applicationCases = sqliteTable('application_cases', {
  id:text('id').primaryKey(), opportunityId:text('opportunity_id').notNull().references(()=>academicOpportunities.id), status:text('status').notNull().default('DISCOVERED'), currentStep:text('current_step'), applicationUrl:text('application_url'), submittedAt:text('submitted_at'), decisionAt:text('decision_at'), notes:text('notes'), ...timestamps
}, table=>[uniqueIndex('idx_application_cases_opportunity').on(table.opportunityId),index('idx_application_cases_status').on(table.status)]);

export const applicationDeadlines = sqliteTable('application_deadlines', {
  id:text('id').primaryKey(), opportunityId:text('opportunity_id').notNull().references(()=>academicOpportunities.id), kind:text('kind').notNull(), deadlineAt:text('deadline_at').notNull(), timezone:text('timezone'), sourceUrl:text('source_url'), confidence:real('confidence').notNull(), status:text('status').notNull().default('ACTIVE'), ...timestamps
}, table=>[index('idx_application_deadlines_due').on(table.status,table.deadlineAt)]);

export const academicDocuments = sqliteTable('academic_documents', {
  id:text('id').primaryKey(), applicantProfileId:text('applicant_profile_id').notNull().references(()=>academicApplicantProfiles.id), kind:text('kind').notNull(), name:text('name').notNull(), storageKey:text('storage_key').notNull(), originalFilename:text('original_filename').notNull(), mimeType:text('mime_type').notNull(), sizeBytes:integer('size_bytes').notNull(), sha256:text('sha256').notNull(), version:integer('version').notNull().default(1), active:integer('active',{mode:'boolean'}).notNull().default(true), metadataJson:text('metadata_json').notNull().default('{}'), ...timestamps
}, table=>[uniqueIndex('idx_academic_documents_storage').on(table.storageKey),index('idx_academic_documents_profile_kind').on(table.applicantProfileId,table.kind)]);

export const academicOutreach = sqliteTable('academic_outreach', {
  id:text('id').primaryKey(), professorCaseId:text('professor_case_id').notNull().references(()=>professorCases.id), opportunityId:text('opportunity_id').references(()=>academicOpportunities.id), recipientEmail:text('recipient_email'), subjectsJson:text('subjects_json').notNull().default('[]'), textBody:text('text_body').notNull(), status:text('status').notNull().default('DRAFT'), selectedDocumentIdsJson:text('selected_document_ids_json').notNull().default('[]'), evidenceIdsJson:text('evidence_ids_json').notNull().default('[]'), idempotencyKey:text('idempotency_key').notNull(), approvedAt:text('approved_at'), sentAt:text('sent_at'), providerMessageId:text('provider_message_id'), replyStatus:text('reply_status').notNull().default('NONE'), followupAt:text('followup_at'), errorJson:text('error_json'), ...timestamps
}, table=>[uniqueIndex('idx_academic_outreach_idempotency').on(table.idempotencyKey),index('idx_academic_outreach_status').on(table.status,table.followupAt)]);

export const academicSignals = sqliteTable('academic_signals', {
  id:text('id').primaryKey(), opportunityId:text('opportunity_id').references(()=>academicOpportunities.id), professorCaseId:text('professor_case_id').references(()=>professorCases.id), type:text('type').notNull(), claim:text('claim').notNull(), severity:text('severity').notNull(), confidence:real('confidence').notNull(), evidenceIdsJson:text('evidence_ids_json').notNull().default('[]'), active:integer('active',{mode:'boolean'}).notNull().default(true), observedAt:text('observed_at').notNull(), createdAt:text('created_at').notNull()
}, table=>[index('idx_academic_signals_opportunity').on(table.opportunityId,table.active)]);

export const academicWatchlists = sqliteTable('academic_watchlists', {
  id:text('id').primaryKey(), name:text('name').notNull(), queryJson:text('query_json').notNull(), enabled:integer('enabled',{mode:'boolean'}).notNull().default(true), refreshIntervalHours:integer('refresh_interval_hours').notNull().default(168), lastRunAt:text('last_run_at'), nextRunAt:text('next_run_at'), ...timestamps
});

export const academicSearches = sqliteTable('academic_searches', {
  id:text('id').primaryKey(), applicantProfileId:text('applicant_profile_id').notNull().references(()=>academicApplicantProfiles.id), filtersJson:text('filters_json').notNull(), status:text('status').notNull().default('QUEUED'), resultCount:integer('result_count').notNull().default(0), progressJson:text('progress_json').notNull().default('{}'), discoveryDiagnosticsJson:text('discovery_diagnostics_json').notNull().default('[]'), discoveryProvider:text('discovery_provider'), discoveryModel:text('discovery_model'), discoveryErrorCategory:text('discovery_error_category'), startedAt:text('started_at'), completedAt:text('completed_at'), errorJson:text('error_json'), ...timestamps
}, table=>[index('idx_academic_searches_profile_created').on(table.applicantProfileId,table.createdAt),index('idx_academic_searches_status').on(table.status)]);

export const academicSearchResults = sqliteTable('academic_search_results', {
  id:text('id').primaryKey(), searchId:text('search_id').notNull().references(()=>academicSearches.id), opportunityId:text('opportunity_id').notNull().references(()=>academicOpportunities.id), discoveredAt:text('discovered_at').notNull(), discoveryQuery:text('discovery_query'), candidateUrl:text('candidate_url'), status:text('status').notNull().default('VERIFIED'), relevanceScore:real('relevance_score').notNull().default(0), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
}, table=>[uniqueIndex('idx_academic_search_results_search_opportunity').on(table.searchId,table.opportunityId),index('idx_academic_search_results_search_time').on(table.searchId,table.discoveredAt)]);

export const academicDiscoveryCandidates = sqliteTable('academic_discovery_candidates', {
  id:text('id').primaryKey(), searchId:text('search_id').notNull().references(()=>academicSearches.id), query:text('query').notNull(), url:text('url').notNull(), title:text('title').notNull(), snippet:text('snippet').notNull().default(''), provider:text('provider').notNull(), model:text('model').notNull(), discoveredAt:text('discovered_at').notNull()
}, table=>[uniqueIndex('idx_academic_discovery_candidates_search_url').on(table.searchId,table.url),index('idx_academic_discovery_candidates_search_time').on(table.searchId,table.discoveredAt)]);

export const academicShortlist = sqliteTable('academic_shortlist', {
  id:text('id').primaryKey(), entityType:text('entity_type').notNull(), entityId:text('entity_id').notNull(), notes:text('notes'), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
}, table=>[uniqueIndex('idx_academic_shortlist_entity').on(table.entityType,table.entityId),index('idx_academic_shortlist_created').on(table.createdAt)]);
