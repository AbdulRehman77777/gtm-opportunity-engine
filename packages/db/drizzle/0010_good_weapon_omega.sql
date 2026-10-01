CREATE TABLE `academic_search_results` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`discovered_at` text NOT NULL,
	`discovery_query` text,
	`candidate_url` text,
	`status` text DEFAULT 'VERIFIED' NOT NULL,
	`relevance_score` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_id`) REFERENCES `academic_searches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `academic_opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_search_results_search_opportunity` ON `academic_search_results` (`search_id`,`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_academic_search_results_search_time` ON `academic_search_results` (`search_id`,`discovered_at`);--> statement-breakpoint
ALTER TABLE `academic_searches` ADD `progress_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `academic_searches` ADD `discovery_provider` text;--> statement-breakpoint
ALTER TABLE `academic_searches` ADD `discovery_model` text;--> statement-breakpoint
ALTER TABLE `academic_searches` ADD `discovery_error_category` text;