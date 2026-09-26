CREATE TABLE `challenge_settings` (
	`challenge_type` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`puzzle` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_attempts` (
	`user_id` text NOT NULL,
	`day_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`elapsed_seconds` integer,
	`puzzle` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_daily_attempts_leaderboard` ON `daily_attempts` (`day_id`,`completed_at`,`elapsed_seconds`);--> statement-breakpoint
ALTER TABLE `weekly_attempts` ADD `puzzle` text;--> statement-breakpoint
PRAGMA optimize;
