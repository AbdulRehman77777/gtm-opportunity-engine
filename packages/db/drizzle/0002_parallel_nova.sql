CREATE TABLE `contact_research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`priority` integer NOT NULL,
	`force_refresh` integer DEFAULT false NOT NULL,
	`people_found` integer DEFAULT 0 NOT NULL,
	`contacts_found` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`error_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_runs_company_created` ON `contact_research_runs` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_contact_runs_status_priority` ON `contact_research_runs` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `contact_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`contact_research_run_id` text NOT NULL,
	`page_id` text,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`content_hash` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_research_run_id`) REFERENCES `contact_research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `company_pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_sources_identity` ON `contact_sources` (`contact_id`,`source_url`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_contact_sources_run` ON `contact_sources` (`contact_research_run_id`);--> statement-breakpoint
CREATE TABLE `contact_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`syntax_valid` integer NOT NULL,
	`domain_matches` integer NOT NULL,
	`disposable` integer NOT NULL,
	`dns_status` text NOT NULL,
	`mx_status` text NOT NULL,
	`mx_hosts_json` text DEFAULT '[]' NOT NULL,
	`checked_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`error_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_validations_contact_checked` ON `contact_validations` (`contact_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`person_id` text,
	`type` text NOT NULL,
	`contact_value` text NOT NULL,
	`normalized_value` text NOT NULL,
	`status` text NOT NULL,
	`confidence` integer NOT NULL,
	`pattern_used` text,
	`first_discovered_at` text NOT NULL,
	`last_checked_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_company_value` ON `contacts` (`company_id`,`normalized_value`);--> statement-breakpoint
CREATE INDEX `idx_contacts_person_confidence` ON `contacts` (`person_id`,`confidence`);--> statement-breakpoint
CREATE TABLE `decision_maker_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`contact_research_run_id` text,
	`primary_person_id` text NOT NULL,
	`secondary_person_id` text,
	`score` integer NOT NULL,
	`reason` text NOT NULL,
	`confidence` real NOT NULL,
	`selected_by` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_research_run_id`) REFERENCES `contact_research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`secondary_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_decision_makers_company_active` ON `decision_maker_selections` (`company_id`,`active`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_decision_makers_primary` ON `decision_maker_selections` (`primary_person_id`);--> statement-breakpoint
CREATE TABLE `email_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`contact_research_run_id` text NOT NULL,
	`domain` text NOT NULL,
	`pattern` text NOT NULL,
	`evidence_emails_json` text NOT NULL,
	`confidence` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_research_run_id`) REFERENCES `contact_research_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_email_patterns_company_created` ON `email_patterns` (`company_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_patterns_run_pattern` ON `email_patterns` (`contact_research_run_id`,`pattern`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`full_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`department` text NOT NULL,
	`seniority` text NOT NULL,
	`decision_maker_score` integer DEFAULT 0 NOT NULL,
	`decision_maker_reason` text,
	`confidence` real NOT NULL,
	`linkedin_url` text,
	`github_url` text,
	`first_discovered_at` text NOT NULL,
	`last_verified_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_people_company_name` ON `people` (`company_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_people_company_rank` ON `people` (`company_id`,`decision_maker_score`);--> statement-breakpoint
CREATE TABLE `person_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`contact_research_run_id` text NOT NULL,
	`page_id` text,
	`claim` text NOT NULL,
	`evidence_text` text NOT NULL,
	`source_url` text NOT NULL,
	`source_quality` text NOT NULL,
	`confidence` real NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_research_run_id`) REFERENCES `contact_research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `company_pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_person_evidence_identity` ON `person_evidence` (`person_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_person_evidence_run` ON `person_evidence` (`contact_research_run_id`);--> statement-breakpoint
CREATE TABLE `person_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`contact_research_run_id` text NOT NULL,
	`page_id` text,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`content_hash` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_research_run_id`) REFERENCES `contact_research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `company_pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_person_sources_identity` ON `person_sources` (`person_id`,`source_url`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_person_sources_run` ON `person_sources` (`contact_research_run_id`);