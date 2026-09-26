CREATE TABLE `solo_games` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`puzzle` text NOT NULL,
	`solution` text NOT NULL,
	`started_at` integer NOT NULL,
	`mistakes` integer DEFAULT 0 NOT NULL,
	`last_mistake_id` text,
	`hints_used` integer DEFAULT 0 NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_solo_games_user` ON `solo_games` (`user_id`,`completed_at`);