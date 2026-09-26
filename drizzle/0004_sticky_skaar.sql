CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_key` text NOT NULL,
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair_key_unique` ON `friendships` (`pair_key`);--> statement-breakpoint
CREATE INDEX `idx_friendships_requester` ON `friendships` (`requester_id`);--> statement-breakpoint
CREATE INDEX `idx_friendships_addressee` ON `friendships` (`addressee_id`);