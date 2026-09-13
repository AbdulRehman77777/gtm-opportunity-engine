DROP INDEX `idx_contact_sources_identity`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_sources_identity` ON `contact_sources` (`contact_id`,`contact_research_run_id`,`source_url`,`content_hash`);--> statement-breakpoint
DROP INDEX `idx_person_evidence_identity`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_person_evidence_identity` ON `person_evidence` (`person_id`,`contact_research_run_id`,`content_hash`);--> statement-breakpoint
DROP INDEX `idx_person_sources_identity`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_person_sources_identity` ON `person_sources` (`person_id`,`contact_research_run_id`,`source_url`,`content_hash`);