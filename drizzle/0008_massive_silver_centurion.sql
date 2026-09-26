CREATE TABLE `cosmetic_purchases` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`price` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `player_cosmetics` (
	`user_id` text PRIMARY KEY NOT NULL,
	`avatar_id` text DEFAULT 'nova' NOT NULL,
	`frame_id` text DEFAULT 'starter' NOT NULL,
	`theme_id` text DEFAULT 'ocean' NOT NULL
);
