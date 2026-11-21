CREATE TABLE `invitation_rewards` (
	`user_id` text NOT NULL,
	`tier` integer NOT NULL,
	`color` text NOT NULL,
	PRIMARY KEY(`user_id`, `tier`)
);
--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `invite_code` text;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `invite_code_at` integer;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `invited_by` text;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `username_color` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_profiles_invite_code` ON `player_profiles` (`invite_code`);
--> statement-breakpoint
CREATE INDEX `idx_player_profiles_invited_by` ON `player_profiles` (`invited_by`);