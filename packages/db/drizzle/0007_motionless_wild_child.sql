CREATE TABLE `academic_applicant_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nationality` text NOT NULL,
	`location` text NOT NULL,
	`education_json` text DEFAULT '[]' NOT NULL,
	`manuscripts_json` text DEFAULT '[]' NOT NULL,
	`background_json` text DEFAULT '{}' NOT NULL,
	`primary_interests_json` text DEFAULT '[]' NOT NULL,
	`secondary_interests_json` text DEFAULT '[]' NOT NULL,
	`country_priorities_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_academic_profiles_active` ON `academic_applicant_profiles` (`active`);--> statement-breakpoint
CREATE TABLE `academic_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`university_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`website_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_departments_identity` ON `academic_departments` (`university_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `academic_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`applicant_profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`applicant_profile_id`) REFERENCES `academic_applicant_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_documents_storage` ON `academic_documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_academic_documents_profile_kind` ON `academic_documents` (`applicant_profile_id`,`kind`);--> statement-breakpoint
CREATE TABLE `academic_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`page_version_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`claim_type` text NOT NULL,
	`claim` text NOT NULL,
	`excerpt` text,
	`source_url` text NOT NULL,
	`classification` text DEFAULT 'FACT' NOT NULL,
	`confidence` real NOT NULL,
	`observed_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `academic_sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_version_id`) REFERENCES `academic_page_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_academic_evidence_entity` ON `academic_evidence` (`entity_type`,`entity_id`,`claim_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_evidence_identity` ON `academic_evidence` (`entity_type`,`entity_id`,`claim_type`,`source_url`,`claim`);--> statement-breakpoint
CREATE TABLE `academic_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`university_id` text NOT NULL,
	`program_id` text,
	`funding_opportunity_id` text,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`degree_level` text NOT NULL,
	`country` text NOT NULL,
	`deadline` text,
	`status` text DEFAULT 'DISCOVERED' NOT NULL,
	`funding_category` text DEFAULT 'UNKNOWN' NOT NULL,
	`eligibility_status` text DEFAULT 'UNKNOWN' NOT NULL,
	`current_score` integer DEFAULT 0 NOT NULL,
	`source_url` text,
	`research_freshness` text DEFAULT 'UNKNOWN' NOT NULL,
	`notes` text,
	`first_discovered_at` text NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `academic_programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funding_opportunity_id`) REFERENCES `funding_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_opportunity_identity` ON `academic_opportunities` (`university_id`,`normalized_title`,`degree_level`);--> statement-breakpoint
CREATE INDEX `idx_academic_opportunity_rank` ON `academic_opportunities` (`status`,`current_score`);--> statement-breakpoint
CREATE TABLE `academic_outreach` (
	`id` text PRIMARY KEY NOT NULL,
	`professor_case_id` text NOT NULL,
	`opportunity_id` text,
	`recipient_email` text,
	`subjects_json` text DEFAULT '[]' NOT NULL,
	`text_body` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`selected_document_ids_json` text DEFAULT '[]' NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`idempotency_key` text NOT NULL,
	`approved_at` text,
	`sent_at` text,
	`provider_message_id` text,
	`reply_status` text DEFAULT 'NONE' NOT NULL,
	`followup_at` text,
	`error_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`professor_case_id`) REFERENCES `professor_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_outreach_idempotency` ON `academic_outreach` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_academic_outreach_status` ON `academic_outreach` (`status`,`followup_at`);--> statement-breakpoint
CREATE TABLE `academic_page_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`research_run_id` text,
	`content_hash` text NOT NULL,
	`title` text,
	`text_content` text NOT NULL,
	`http_status` integer,
	`retrieved_at` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `academic_sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_run_id`) REFERENCES `academic_research_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_page_versions_hash` ON `academic_page_versions` (`source_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_academic_page_versions_time` ON `academic_page_versions` (`source_id`,`retrieved_at`);--> statement-breakpoint
CREATE TABLE `academic_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`university_id` text NOT NULL,
	`department_id` text,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`degree_level` text NOT NULL,
	`website_url` text,
	`application_url` text,
	`duration` text,
	`requirements_json` text DEFAULT '{}' NOT NULL,
	`contact_professor_policy` text DEFAULT 'UNKNOWN' NOT NULL,
	`supervisor_approval_required` text DEFAULT 'UNKNOWN' NOT NULL,
	`direct_bachelors_to_phd` text DEFAULT 'UNKNOWN' NOT NULL,
	`admissions_status` text DEFAULT 'UNKNOWN' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `academic_departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_programs_identity` ON `academic_programs` (`university_id`,`normalized_name`,`degree_level`);--> statement-breakpoint
CREATE TABLE `academic_research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`entity_type` text,
	`entity_id` text,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`changed` integer DEFAULT false NOT NULL,
	`error_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `academic_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_academic_runs_entity` ON `academic_research_runs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `academic_score_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`total` integer NOT NULL,
	`components_json` text NOT NULL,
	`explanations_json` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`model_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_academic_scores_opportunity_time` ON `academic_score_snapshots` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `academic_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text,
	`professor_case_id` text,
	`type` text NOT NULL,
	`claim` text NOT NULL,
	`severity` text NOT NULL,
	`confidence` real NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`observed_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`professor_case_id`) REFERENCES `professor_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_academic_signals_opportunity` ON `academic_signals` (`opportunity_id`,`active`);--> statement-breakpoint
CREATE TABLE `academic_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`official` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`refresh_interval_hours` integer DEFAULT 168 NOT NULL,
	`last_retrieved_at` text,
	`next_refresh_at` text,
	`last_content_hash` text,
	`last_status` text DEFAULT 'NEW' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_sources_url` ON `academic_sources` (`canonical_url`);--> statement-breakpoint
CREATE INDEX `idx_academic_sources_refresh` ON `academic_sources` (`enabled`,`next_refresh_at`);--> statement-breakpoint
CREATE TABLE `academic_watchlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`query_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`refresh_interval_hours` integer DEFAULT 168 NOT NULL,
	`last_run_at` text,
	`next_run_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `application_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`status` text DEFAULT 'DISCOVERED' NOT NULL,
	`current_step` text,
	`application_url` text,
	`submitted_at` text,
	`decision_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_application_cases_opportunity` ON `application_cases` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_application_cases_status` ON `application_cases` (`status`);--> statement-breakpoint
CREATE TABLE `application_deadlines` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`kind` text NOT NULL,
	`deadline_at` text NOT NULL,
	`timezone` text,
	`source_url` text,
	`confidence` real NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_application_deadlines_due` ON `application_deadlines` (`status`,`deadline_at`);--> statement-breakpoint
CREATE TABLE `eligibility_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`applicant_profile_id` text NOT NULL,
	`status` text NOT NULL,
	`criteria_json` text NOT NULL,
	`reasons_json` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`rules_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`applicant_profile_id`) REFERENCES `academic_applicant_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_eligibility_opportunity_time` ON `eligibility_checks` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `funding_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`university_id` text,
	`program_id` text,
	`name` text NOT NULL,
	`category` text DEFAULT 'UNKNOWN' NOT NULL,
	`tuition_coverage` text,
	`stipend_amount` real,
	`stipend_currency` text,
	`stipend_period` text,
	`accommodation` text,
	`health_insurance` text,
	`travel` text,
	`research_allowance` text,
	`assistantship` text,
	`employment_contract` text,
	`duration` text,
	`conditions` text,
	`official_source_url` text,
	`deadline` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `academic_programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_funding_category` ON `funding_opportunities` (`category`);--> statement-breakpoint
CREATE INDEX `idx_funding_deadline` ON `funding_opportunities` (`deadline`);--> statement-breakpoint
CREATE TABLE `professor_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`professor_id` text NOT NULL,
	`opportunity_id` text,
	`status` text DEFAULT 'RESEARCHING' NOT NULL,
	`match_summary` text,
	`matching_skills_json` text DEFAULT '[]' NOT NULL,
	`matching_interests_json` text DEFAULT '[]' NOT NULL,
	`matching_experience_json` text DEFAULT '[]' NOT NULL,
	`research_ideas_json` text DEFAULT '[]' NOT NULL,
	`weaknesses_json` text DEFAULT '[]' NOT NULL,
	`match_confidence` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`professor_id`) REFERENCES `professors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_professor_cases_identity` ON `professor_cases` (`professor_id`,`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_professor_cases_status` ON `professor_cases` (`status`);--> statement-breakpoint
CREATE TABLE `professors` (
	`id` text PRIMARY KEY NOT NULL,
	`university_id` text NOT NULL,
	`department_id` text,
	`research_group_id` text,
	`full_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`title` text,
	`official_profile_url` text,
	`lab_url` text,
	`scholar_url` text,
	`orcid` text,
	`public_email` text,
	`contact_json` text DEFAULT '{}' NOT NULL,
	`research_areas_json` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`recent_works_json` text DEFAULT '[]' NOT NULL,
	`projects_json` text DEFAULT '[]' NOT NULL,
	`grants_json` text DEFAULT '[]' NOT NULL,
	`supervision_evidence` text,
	`recruiting_evidence` text,
	`open_positions_json` text DEFAULT '[]' NOT NULL,
	`first_discovered_at` text NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `academic_departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_group_id`) REFERENCES `research_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_professors_identity` ON `professors` (`university_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_professors_email` ON `professors` (`public_email`);--> statement-breakpoint
CREATE TABLE `research_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`university_id` text NOT NULL,
	`department_id` text,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`website_url` text,
	`focus_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `academic_departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_research_groups_identity` ON `research_groups` (`university_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `scholarships` (
	`id` text PRIMARY KEY NOT NULL,
	`funding_opportunity_id` text NOT NULL,
	`provider` text,
	`countries_json` text DEFAULT '[]' NOT NULL,
	`citizenship_restrictions` text,
	`age_restrictions` text,
	`application_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`funding_opportunity_id`) REFERENCES `funding_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `universities` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`country` text NOT NULL,
	`city` text,
	`official_url` text,
	`admissions_url` text,
	`graduate_admissions_url` text,
	`tuition_model` text DEFAULT 'UNKNOWN' NOT NULL,
	`application_fee` text,
	`funding_summary` text,
	`english_requirements` text,
	`gre_requirements` text,
	`gpa_requirements` text,
	`degree_prerequisites` text,
	`international_eligibility` text DEFAULT 'UNKNOWN' NOT NULL,
	`pakistani_eligibility` text DEFAULT 'UNKNOWN' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`first_discovered_at` text NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_universities_identity` ON `universities` (`normalized_name`,`country`);--> statement-breakpoint
CREATE INDEX `idx_universities_country` ON `universities` (`country`);