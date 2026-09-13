CREATE TABLE `backup_history` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`size_bytes` integer,
	`status` text NOT NULL,
	`error_json` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_backup_history_created` ON `backup_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `learning_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`funnel` text NOT NULL,
	`feature` text NOT NULL,
	`current_weight` real,
	`suggested_weight` real,
	`reason` text NOT NULL,
	`sample_size` integer NOT NULL,
	`success_count` integer NOT NULL,
	`rate` real NOT NULL,
	`baseline_rate` real NOT NULL,
	`reliability` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`decided_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_learning_recommendations_status` ON `learning_recommendations` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_learning_recommendations_feature` ON `learning_recommendations` (`type`,`funnel`,`feature`,`created_at`);--> statement-breakpoint
CREATE TABLE `model_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`model_snapshot_id` text NOT NULL,
	`funnel` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`target` text NOT NULL,
	`probability` real,
	`confidence_band` text NOT NULL,
	`explanation_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`model_snapshot_id`) REFERENCES `model_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_model_predictions_identity` ON `model_predictions` (`model_snapshot_id`,`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_model_predictions_opportunity` ON `model_predictions` (`funnel`,`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `model_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`funnel` text NOT NULL,
	`target` text NOT NULL,
	`model_version` text NOT NULL,
	`feature_version` text NOT NULL,
	`training_window_start` text,
	`training_window_end` text NOT NULL,
	`sample_size` integer NOT NULL,
	`positive_count` integer NOT NULL,
	`feature_list_json` text NOT NULL,
	`coefficients_json` text,
	`metrics_json` text NOT NULL,
	`calibration_status` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_model_snapshots_target` ON `model_snapshots` (`funnel`,`target`,`created_at`);--> statement-breakpoint
CREATE TABLE `scheduler_leases` (
	`key` text PRIMARY KEY NOT NULL,
	`last_run_at` text,
	`next_run_at` text NOT NULL,
	`locked_at` text,
	`locked_by` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_scheduler_due` ON `scheduler_leases` (`next_run_at`);