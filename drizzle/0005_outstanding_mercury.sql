ALTER TABLE `daily_attempts` ADD `mistakes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_attempts` ADD `last_mistake_id` text;--> statement-breakpoint
ALTER TABLE `weekly_attempts` ADD `mistakes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_attempts` ADD `last_mistake_id` text;