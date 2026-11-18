CREATE TABLE `tournament_entries` (
	`tournament_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`fee` integer NOT NULL,
	`payout` integer DEFAULT 0 NOT NULL,
	`mistakes` integer DEFAULT 0 NOT NULL,
	`last_mistake` text,
	`finished_at` integer,
	PRIMARY KEY(`tournament_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `tournament_entries_user` ON `tournament_entries` (`user_id`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`puzzle` text NOT NULL,
	`solution` text NOT NULL,
	`settled` text
);
--> statement-breakpoint
CREATE INDEX `tournaments_start` ON `tournaments` (`starts_at`);