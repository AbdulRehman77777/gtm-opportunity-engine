CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`research_run_id` text,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`input_hash` text NOT NULL,
	`input_json` text NOT NULL,
	`output_json` text,
	`status` text NOT NULL,
	`latency_ms` integer NOT NULL,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`error_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_run_id`) REFERENCES `company_research_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_runs_company_task` ON `ai_runs` (`company_id`,`task`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_runs_input` ON `ai_runs` (`task`,`input_hash`,`status`);--> statement-breakpoint
CREATE TABLE `company_page_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`http_status` integer,
	`content_type` text,
	`title` text,
	`meta_description` text,
	`text_content` text,
	`headings_json` text DEFAULT '[]' NOT NULL,
	`links_json` text DEFAULT '[]' NOT NULL,
	`emails_json` text DEFAULT '[]' NOT NULL,
	`social_urls_json` text DEFAULT '[]' NOT NULL,
	`structured_data_json` text DEFAULT '[]' NOT NULL,
	`content_hash` text,
	`fetched_at` text NOT NULL,
	`fetch_duration_ms` integer NOT NULL,
	`source` text DEFAULT 'HTTP' NOT NULL,
	`error_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `company_pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_versions_hash` ON `company_page_versions` (`page_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_page_versions_fetched` ON `company_page_versions` (`page_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `company_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`page_type` text NOT NULL,
	`current_version_id` text,
	`first_fetched_at` text NOT NULL,
	`last_fetched_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_company_pages_canonical` ON `company_pages` (`company_id`,`canonical_url`);--> statement-breakpoint
CREATE INDEX `idx_company_pages_expiry` ON `company_pages` (`company_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `company_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`research_run_id` text NOT NULL,
	`summary` text,
	`industry` text,
	`business_model` text,
	`stage` text,
	`locations_json` text DEFAULT '[]' NOT NULL,
	`products_json` text DEFAULT '[]' NOT NULL,
	`services_json` text DEFAULT '[]' NOT NULL,
	`customer_types_json` text DEFAULT '[]' NOT NULL,
	`technical_focus_json` text DEFAULT '[]' NOT NULL,
	`growth_signals_json` text DEFAULT '[]' NOT NULL,
	`hiring_signals_json` text DEFAULT '[]' NOT NULL,
	`ai_relevance` real NOT NULL,
	`engineering_need` real NOT NULL,
	`contactability` real NOT NULL,
	`research_confidence` real NOT NULL,
	`what_is_happening` text NOT NULL,
	`why_it_matters` text NOT NULL,
	`why_match` text NOT NULL,
	`recommended_next_step` text NOT NULL,
	`ai_analysis_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_run_id`) REFERENCES `company_research_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_company_profiles_run` ON `company_profiles` (`research_run_id`);--> statement-breakpoint
CREATE INDEX `idx_company_profiles_company_created` ON `company_profiles` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `company_research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`priority` integer NOT NULL,
	`force_refresh` integer DEFAULT false NOT NULL,
	`started_at` text,
	`completed_at` text,
	`pages_attempted` integer DEFAULT 0 NOT NULL,
	`pages_fetched` integer DEFAULT 0 NOT NULL,
	`pages_reused` integer DEFAULT 0 NOT NULL,
	`evidence_count` integer DEFAULT 0 NOT NULL,
	`signal_count` integer DEFAULT 0 NOT NULL,
	`deterministic_complete` integer DEFAULT false NOT NULL,
	`ai_status` text DEFAULT 'NOT_ATTEMPTED' NOT NULL,
	`research_confidence` real,
	`error_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_research_runs_company_created` ON `company_research_runs` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_research_runs_status_priority` ON `company_research_runs` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `domain_resolutions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`research_run_id` text NOT NULL,
	`candidate_domain` text,
	`method` text NOT NULL,
	`confidence` real NOT NULL,
	`evidence_url` text,
	`accepted` integer NOT NULL,
	`resolved_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_run_id`) REFERENCES `company_research_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_domain_resolutions_company_time` ON `domain_resolutions` (`company_id`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `idx_domain_resolutions_run` ON `domain_resolutions` (`research_run_id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`research_run_id` text NOT NULL,
	`page_id` text,
	`type` text NOT NULL,
	`classification` text NOT NULL,
	`claim` text NOT NULL,
	`evidence_text` text NOT NULL,
	`source_url` text NOT NULL,
	`source_quality` text NOT NULL,
	`confidence` real NOT NULL,
	`extractor` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`research_run_id`) REFERENCES `company_research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `company_pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_run_hash` ON `evidence` (`research_run_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_evidence_company_type` ON `evidence` (`company_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_evidence_run` ON `evidence` (`research_run_id`);--> statement-breakpoint
CREATE TABLE `evidence_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_signals_identity` ON `evidence_signals` (`signal_id`,`evidence_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_signals_evidence` ON `evidence_signals` (`evidence_id`);--> statement-breakpoint
CREATE TABLE `research_run_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`research_run_id` text NOT NULL,
	`page_id` text NOT NULL,
	`page_version_id` text,
	`outcome` text NOT NULL,
	`relevance_score` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`research_run_id`) REFERENCES `company_research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `company_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_version_id`) REFERENCES `company_page_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_research_run_pages_identity` ON `research_run_pages` (`research_run_id`,`page_id`);--> statement-breakpoint
CREATE INDEX `idx_research_run_pages_version` ON `research_run_pages` (`page_version_id`);--> statement-breakpoint
ALTER TABLE `client_opportunities` ADD `initial_score` integer;--> statement-breakpoint
ALTER TABLE `companies` ADD `resolved_domain` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `domain_resolution_method` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `domain_confidence` real;--> statement-breakpoint
ALTER TABLE `companies` ADD `domain_resolved_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `research_status` text DEFAULT 'NOT_RESEARCHED' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `current_profile_id` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `last_researched_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `next_research_after` text;--> statement-breakpoint
CREATE INDEX `idx_companies_research_status` ON `companies` (`research_status`);--> statement-breakpoint
CREATE INDEX `idx_companies_next_research` ON `companies` (`next_research_after`);--> statement-breakpoint
ALTER TABLE `job_opportunities` ADD `initial_score` integer;--> statement-breakpoint
ALTER TABLE `signals` ADD `severity` text DEFAULT 'MEDIUM' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `weight` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `source_quality` text DEFAULT 'FIRST_PARTY_HIGH' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `detected_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `client_opportunities` SET `initial_score` = `current_score` WHERE `initial_score` IS NULL;
--> statement-breakpoint
UPDATE `job_opportunities` SET `initial_score` = `current_score` WHERE `initial_score` IS NULL;
--> statement-breakpoint
UPDATE `signals` SET `detected_at` = `observed_at` WHERE `detected_at` = '';
