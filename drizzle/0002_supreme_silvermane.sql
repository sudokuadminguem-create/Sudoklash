CREATE TABLE `player_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_username_unique` ON `player_profiles` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_username_key_unique` ON `player_profiles` (`username_key`);