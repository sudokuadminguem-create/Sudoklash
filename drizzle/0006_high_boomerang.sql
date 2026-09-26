CREATE TABLE `ranked_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`player1_id` text NOT NULL,
	`player2_id` text NOT NULL,
	`puzzle` text NOT NULL,
	`solution` text NOT NULL,
	`started_at` integer NOT NULL,
	`status` text DEFAULT 'playing' NOT NULL,
	`winner_id` text,
	`player1_progress` integer DEFAULT 0 NOT NULL,
	`player2_progress` integer DEFAULT 0 NOT NULL,
	`player1_mistakes` integer DEFAULT 0 NOT NULL,
	`player2_mistakes` integer DEFAULT 0 NOT NULL,
	`player1_last_mistake_id` text,
	`player2_last_mistake_id` text,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_ranked_matches_player1` ON `ranked_matches` (`player1_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_ranked_matches_player2` ON `ranked_matches` (`player2_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `ranked_queue` (
	`user_id` text PRIMARY KEY NOT NULL,
	`queued_at` integer NOT NULL,
	`heartbeat_at` integer NOT NULL,
	`match_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_ranked_queue_waiting` ON `ranked_queue` (`match_id`,`queued_at`);