CREATE TABLE `solo_results` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_solo_results_user` ON `solo_results` (`user_id`,`completed_at`);