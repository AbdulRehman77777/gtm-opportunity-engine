CREATE TABLE `academic_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`applicant_profile_id` text NOT NULL,
	`filters_json` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`error_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`applicant_profile_id`) REFERENCES `academic_applicant_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_academic_searches_profile_created` ON `academic_searches` (`applicant_profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_academic_searches_status` ON `academic_searches` (`status`);--> statement-breakpoint
CREATE TABLE `academic_shortlist` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academic_shortlist_entity` ON `academic_shortlist` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_academic_shortlist_created` ON `academic_shortlist` (`created_at`);
--> statement-breakpoint
UPDATE `academic_applicant_profiles` SET
  `background_json`='{"summary":"AI engineering and applied AI research; approximately 2–3 years of AI-focused technical project management / technical delivery and AI research; approximately two years of university-level teaching; interdisciplinary computer science and linguistics background.","productionExperience":["AI/ML","LLMs","RAG","agentic AI","AI automation","APIs","cloud deployment","full-stack systems"]}',
  `primary_interests_json`='["Artificial Intelligence","Computer Science","Robotics + AI","LLM reasoning","AI memory","Recursive reasoning","Agentic AI","Autonomous systems","Code generation and repair","Model evaluation"]',
  `secondary_interests_json`='["Machine Learning","NLP","Multilingual NLP","Computational Linguistics","Computer Vision","LLM bias/fairness","Human-AI Interaction"]',
  `updated_at`=datetime('now')
WHERE `name`='Abdul Rehman'
  AND `primary_interests_json`='["Artificial Intelligence","Robotics + AI","Computer Science"]'
  AND `manuscripts_json` LIKE '%"status":"MANUSCRIPT"%';
