CREATE TABLE `ranked_ratings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ranked_ratings_points` ON `ranked_ratings` (`points`,`user_id`);--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `difficulty` text DEFAULT 'Intermédiaire' NOT NULL;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `rated_at` integer;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `rating_token` text;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `player1_points_before` integer;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `player2_points_before` integer;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `player1_points_change` integer;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `player2_points_change` integer;--> statement-breakpoint
ALTER TABLE `ranked_matches` ADD `finish_reason` text;--> statement-breakpoint
ALTER TABLE `ranked_queue` ADD `difficulty` text DEFAULT 'Intermédiaire' NOT NULL;