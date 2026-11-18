CREATE TABLE `live_presence` (
	`tab_id` text PRIMARY KEY NOT NULL,
	`browser_id` text NOT NULL,
	`revision` integer NOT NULL,
	`active` integer NOT NULL,
	`seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_presence_seen_at` ON `live_presence` (`seen_at`);