CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`type` text NOT NULL,
	`actor` text DEFAULT 'SYSTEM' NOT NULL,
	`from_status` text,
	`to_status` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activities_entity_time` ON `activities` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_activities_type_time` ON `activities` (`type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `client_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`trigger_job_id` text,
	`status` text DEFAULT 'DISCOVERED' NOT NULL,
	`recommended_action` text NOT NULL,
	`current_score` integer NOT NULL,
	`discovered_at` text NOT NULL,
	`last_activity_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trigger_job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_client_opportunities_trigger` ON `client_opportunities` (`company_id`,`trigger_job_id`);--> statement-breakpoint
CREATE INDEX `idx_client_opportunities_status_score` ON `client_opportunities` (`status`,`current_score`);--> statement-breakpoint
CREATE TABLE `client_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`total` integer NOT NULL,
	`components_json` text NOT NULL,
	`reasons_json` text NOT NULL,
	`model_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_client_scores_opportunity_created` ON `client_scores` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`domain` text,
	`country` text,
	`description` text,
	`industry` text,
	`first_discovered_at` text NOT NULL,
	`last_observed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_companies_domain` ON `companies` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_companies_normalized_name` ON `companies` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `company_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text,
	`source_url` text,
	`raw_data_json` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`observation_count` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_company_sources_identity` ON `company_sources` (`company_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_company_sources_source` ON `company_sources` (`source_id`);--> statement-breakpoint
CREATE TABLE `conversion_events` (
	`id` text PRIMARY KEY NOT NULL,
	`funnel` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`stage` text NOT NULL,
	`source_id` text,
	`campaign_id` text,
	`revenue_cents` integer,
	`currency` text DEFAULT 'USD',
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_conversion_funnel_stage_time` ON `conversion_events` (`funnel`,`stage`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_conversion_source_stage` ON `conversion_events` (`source_id`,`stage`);--> statement-breakpoint
CREATE TABLE `job_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'DISCOVERED' NOT NULL,
	`recommended_action` text NOT NULL,
	`current_score` integer NOT NULL,
	`discovered_at` text NOT NULL,
	`last_activity_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_opportunities_job` ON `job_opportunities` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_job_opportunities_status_score` ON `job_opportunities` (`status`,`current_score`);--> statement-breakpoint
CREATE TABLE `job_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`total` integer NOT NULL,
	`components_json` text NOT NULL,
	`reasons_json` text NOT NULL,
	`model_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `job_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_job_scores_opportunity_created` ON `job_scores` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `job_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_run_id` text,
	`external_id` text NOT NULL,
	`source_url` text NOT NULL,
	`raw_data_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`observation_count` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_run_id`) REFERENCES `source_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_sources_external` ON `job_sources` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_job_sources_job` ON `job_sources` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_job_sources_run` ON `job_sources` (`source_run_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text NOT NULL,
	`country` text,
	`remote_type` text NOT NULL,
	`employment_type` text,
	`compensation` text,
	`posted_at` text,
	`first_discovered_at` text NOT NULL,
	`last_observed_at` text NOT NULL,
	`expired_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jobs_fingerprint` ON `jobs` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_jobs_company` ON `jobs` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_jobs_posted` ON `jobs` (`posted_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signal_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text NOT NULL,
	`source_url` text NOT NULL,
	`evidence_text` text NOT NULL,
	`observed_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_signal_evidence_signal` ON `signal_evidence` (`signal_id`);--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`job_id` text,
	`type` text NOT NULL,
	`claim` text NOT NULL,
	`confidence` real NOT NULL,
	`observed_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_signals_company_type` ON `signals` (`company_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_signals_job` ON `signals` (`job_id`);--> statement-breakpoint
CREATE TABLE `source_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`pages_processed` integer DEFAULT 0 NOT NULL,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_created` integer DEFAULT 0 NOT NULL,
	`records_updated` integer DEFAULT 0 NOT NULL,
	`duplicates_detected` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`rate_limit_events` integer DEFAULT 0 NOT NULL,
	`runtime_ms` integer,
	`checkpoint` text,
	`error_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_source_runs_source_started` ON `source_runs` (`source_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_source_runs_status` ON `source_runs` (`status`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`checkpoint` text,
	`last_successful_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sources_kind_name` ON `sources` (`kind`,`name`);--> statement-breakpoint
CREATE TABLE `worker_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_after` text NOT NULL,
	`idempotency_key` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`error_json` text,
	`result_json` text,
	`locked_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_worker_jobs_idempotency` ON `worker_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_worker_jobs_claim` ON `worker_jobs` (`status`,`run_after`,`priority`);