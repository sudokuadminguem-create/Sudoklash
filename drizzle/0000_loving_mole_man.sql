CREATE TABLE `weekly_attempts` (
	`user_id` text NOT NULL,
	`week_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`elapsed_seconds` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `week_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_attempts_leaderboard` ON `weekly_attempts` (`week_id`,`completed_at`,`elapsed_seconds`);