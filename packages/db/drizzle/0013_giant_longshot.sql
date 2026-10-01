ALTER TABLE `academic_discovery_candidates` ADD `relevance_score` real;--> statement-breakpoint
ALTER TABLE `academic_discovery_candidates` ADD `provider_metadata_json` text DEFAULT '{}' NOT NULL;