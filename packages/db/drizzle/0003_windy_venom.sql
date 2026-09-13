CREATE TABLE `dns_cache` (
	`domain` text PRIMARY KEY NOT NULL,
	`dns_status` text NOT NULL,
	`mx_status` text NOT NULL,
	`mx_hosts_json` text DEFAULT '[]' NOT NULL,
	`checked_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`error_json` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_dns_cache_expires` ON `dns_cache` (`expires_at`);