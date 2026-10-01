CREATE TABLE `academic_discovery_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text NOT NULL,
	`query` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`discovered_at` text NOT NULL,
	FOREIGN KEY (`search_id`) REFERENCES `academic_searches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_discovery_candidates_search_url` ON `academic_discovery_candidates` (`search_id`,`url`);--> statement-breakpoint
CREATE INDEX `idx_academic_discovery_candidates_search_time` ON `academic_discovery_candidates` (`search_id`,`discovered_at`);