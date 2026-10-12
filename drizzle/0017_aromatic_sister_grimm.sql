CREATE TABLE `premium_credits` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pack_id` text NOT NULL,
	`gems` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`credited_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_premium_credits_user` ON `premium_credits` (`user_id`);--> statement-breakpoint
ALTER TABLE `cosmetic_purchases` ADD `premium_price` integer DEFAULT 0 NOT NULL;