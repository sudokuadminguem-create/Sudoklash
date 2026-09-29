CREATE TABLE `friend_duels` (
	`id` text PRIMARY KEY NOT NULL,
	`challenger_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`puzzle` text DEFAULT '' NOT NULL,
	`solution` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`winner_id` text,
	`finish_reason` text,
	`challenger_solved` text DEFAULT '' NOT NULL,
	`opponent_solved` text DEFAULT '' NOT NULL,
	`challenger_progress` integer DEFAULT 0 NOT NULL,
	`opponent_progress` integer DEFAULT 0 NOT NULL,
	`challenger_mistakes` integer DEFAULT 0 NOT NULL,
	`opponent_mistakes` integer DEFAULT 0 NOT NULL,
	`challenger_last_mistake` text,
	`opponent_last_mistake` text,
	`challenger_seen_at` integer,
	`opponent_seen_at` integer,
	`challenger_dismissed` integer DEFAULT 0 NOT NULL,
	`opponent_dismissed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_friend_duels_challenger` ON `friend_duels` (`challenger_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_friend_duels_opponent` ON `friend_duels` (`opponent_id`,`status`);