CREATE TABLE `application_material_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`version` integer NOT NULL,
	`parent_version_id` text,
	`materials_json` text NOT NULL,
	`created_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `application_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_application_material_versions_number` ON `application_material_versions` (`package_id`,`version`);--> statement-breakpoint
CREATE TABLE `application_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`candidate_profile_id` text NOT NULL,
	`candidate_profile_hash` text NOT NULL,
	`job_hash` text NOT NULL,
	`status` text NOT NULL,
	`match_score` integer NOT NULL,
	`match_json` text NOT NULL,
	`current_version_id` text,
	`prompt_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `job_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_profile_id`) REFERENCES `candidate_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_application_packages_inputs` ON `application_packages` (`opportunity_id`,`candidate_profile_hash`,`job_hash`,`prompt_version`);--> statement-breakpoint
CREATE INDEX `idx_application_packages_status` ON `application_packages` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`package_id` text,
	`application_url` text NOT NULL,
	`source` text NOT NULL,
	`resume_version_id` text,
	`cover_letter_version_id` text,
	`status` text NOT NULL,
	`applied_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `job_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `application_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resume_version_id`) REFERENCES `resume_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_letter_version_id`) REFERENCES `application_material_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_applications_opportunity` ON `applications` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_applications_status` ON `applications` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `campaign_members` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`person_id` text,
	`service_match_id` text,
	`channel` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_match_id`) REFERENCES `service_matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_campaign_members_identity` ON `campaign_members` (`campaign_id`,`opportunity_id`,`channel`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`primary_service_id` text,
	`targeting_json` text DEFAULT '{}' NOT NULL,
	`message_strategy` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`primary_service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_status` ON `campaigns` (`status`);--> statement-breakpoint
CREATE TABLE `candidate_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`professional_title` text NOT NULL,
	`summary` text NOT NULL,
	`skills_json` text NOT NULL,
	`technologies_json` text NOT NULL,
	`experience_json` text NOT NULL,
	`portfolio_url` text,
	`github_url` text,
	`linkedin_url` text,
	`preferences_json` text NOT NULL,
	`input_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_candidate_profile_hash` ON `candidate_profiles` (`input_hash`);--> statement-breakpoint
CREATE INDEX `idx_candidate_profile_active` ON `candidate_profiles` (`active`,`version`);--> statement-breakpoint
CREATE TABLE `candidate_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_profile_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`problem` text,
	`solution` text,
	`technologies_json` text NOT NULL,
	`ai_capabilities_json` text DEFAULT '[]' NOT NULL,
	`industry` text,
	`url` text,
	`repository_url` text,
	`results` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_profile_id`) REFERENCES `candidate_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_candidate_projects_profile` ON `candidate_projects` (`candidate_profile_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`service_id` text,
	`campaign_id` text,
	`person_id` text,
	`source_id` text,
	`value_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`status` text NOT NULL,
	`won_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_deals_opportunity` ON `deals` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_deals_status_won` ON `deals` (`status`,`won_at`);--> statement-breakpoint
CREATE TABLE `email_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`outreach_message_id` text,
	`direction` text NOT NULL,
	`message_id` text,
	`in_reply_to` text,
	`references_json` text DEFAULT '[]' NOT NULL,
	`sender` text NOT NULL,
	`recipients_json` text NOT NULL,
	`subject` text NOT NULL,
	`text_body` text NOT NULL,
	`html_body` text,
	`raw_metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `email_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`outreach_message_id`) REFERENCES `outreach_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_messages_message_id` ON `email_messages` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_email_messages_thread` ON `email_messages` (`thread_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `email_send_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`outreach_message_id` text NOT NULL,
	`message_version_id` text NOT NULL,
	`recipient` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`provider_message_id` text,
	`provider_response_json` text,
	`error_json` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`outreach_message_id`) REFERENCES `outreach_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_version_id`) REFERENCES `outreach_message_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_send_idempotency` ON `email_send_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_email_send_limits` ON `email_send_attempts` (`status`,`completed_at`);--> statement-breakpoint
CREATE TABLE `email_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text,
	`person_id` text,
	`contact_id` text,
	`campaign_id` text,
	`subject` text NOT NULL,
	`normalized_subject` text NOT NULL,
	`provider_thread_id` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`last_message_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_email_threads_opportunity` ON `email_threads` (`opportunity_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_email_threads_subject` ON `email_threads` (`normalized_subject`);--> statement-breakpoint
CREATE TABLE `followup_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`thread_id` text,
	`status` text NOT NULL,
	`approval_mode` text DEFAULT 'MANUAL_APPROVAL' NOT NULL,
	`next_due_at` text,
	`stop_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thread_id`) REFERENCES `email_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_followup_sequences_due` ON `followup_sequences` (`status`,`next_due_at`);--> statement-breakpoint
CREATE INDEX `idx_followup_sequences_opportunity` ON `followup_sequences` (`opportunity_id`);--> statement-breakpoint
CREATE TABLE `followup_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`outreach_message_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`due_at` text NOT NULL,
	`status` text NOT NULL,
	`approved_at` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `followup_sequences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`outreach_message_id`) REFERENCES `outreach_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_followup_steps_identity` ON `followup_steps` (`sequence_id`,`step_number`);--> statement-breakpoint
CREATE INDEX `idx_followup_steps_due` ON `followup_steps` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `inbound_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`mailbox` text NOT NULL,
	`uid_validity` text,
	`last_uid` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inbound_checkpoint_mailbox` ON `inbound_checkpoints` (`provider`,`mailbox`);--> statement-breakpoint
CREATE TABLE `outreach_message_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`message_version_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`message_version_id`) REFERENCES `outreach_message_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outreach_message_evidence_identity` ON `outreach_message_evidence` (`message_version_id`,`evidence_id`);--> statement-breakpoint
CREATE TABLE `outreach_message_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`version` integer NOT NULL,
	`parent_version_id` text,
	`subjects_json` text DEFAULT '[]' NOT NULL,
	`text_body` text NOT NULL,
	`html_body` text,
	`created_by` text NOT NULL,
	`status` text NOT NULL,
	`prompt_version` text NOT NULL,
	`evidence_hash` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `outreach_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outreach_versions_number` ON `outreach_message_versions` (`message_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_outreach_versions_created` ON `outreach_message_versions` (`message_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `outreach_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`strategy_id` text NOT NULL,
	`campaign_id` text,
	`channel` text NOT NULL,
	`followup_number` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`current_version_id` text,
	`stale_reason` text,
	`approved_at` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strategy_id`) REFERENCES `outreach_strategies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_outreach_messages_queue` ON `outreach_messages` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outreach_message_strategy_step` ON `outreach_messages` (`strategy_id`,`channel`,`followup_number`);--> statement-breakpoint
CREATE TABLE `outreach_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`company_id` text NOT NULL,
	`person_id` text NOT NULL,
	`contact_id` text,
	`service_match_id` text NOT NULL,
	`primary_signal` text NOT NULL,
	`angle` text NOT NULL,
	`cta` text NOT NULL,
	`confidence` real NOT NULL,
	`evidence_hash` text NOT NULL,
	`prompt_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_match_id`) REFERENCES `service_matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outreach_strategy_inputs` ON `outreach_strategies` (`opportunity_id`,`person_id`,`service_match_id`,`evidence_hash`,`prompt_version`);--> statement-breakpoint
CREATE TABLE `reply_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`email_message_id` text NOT NULL,
	`classification` text NOT NULL,
	`confidence` real NOT NULL,
	`reason` text NOT NULL,
	`classifier` text NOT NULL,
	`model` text,
	`prompt_version` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`email_message_id`) REFERENCES `email_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reply_classifications_message` ON `reply_classifications` (`email_message_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reply_classifications_type` ON `reply_classifications` (`classification`,`created_at`);--> statement-breakpoint
CREATE TABLE `resume_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_profile_id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`content_text` text,
	`file_path` text,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_profile_id`) REFERENCES `candidate_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_resume_versions_name` ON `resume_versions` (`candidate_profile_id`,`name`,`version`);--> statement-breakpoint
CREATE TABLE `service_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`company_id` text NOT NULL,
	`primary_service_id` text NOT NULL,
	`secondary_service_id` text,
	`confidence` real NOT NULL,
	`reason` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`input_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `client_opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`secondary_service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_matches_input` ON `service_matches` (`opportunity_id`,`input_hash`);--> statement-breakpoint
CREATE INDEX `idx_service_matches_company` ON `service_matches` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_services_slug` ON `services` (`slug`);--> statement-breakpoint
CREATE TABLE `suppression_list` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_value` text NOT NULL,
	`normalized_value` text NOT NULL,
	`reason` text NOT NULL,
	`source_entity_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`lifted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_suppression_lookup` ON `suppression_list` (`normalized_value`,`active`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`priority` integer NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`completed_at` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_action_center` ON `tasks` (`status`,`due_at`,`priority`);--> statement-breakpoint
CREATE INDEX `idx_tasks_entity` ON `tasks` (`entity_type`,`entity_id`);