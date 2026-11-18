CREATE TABLE `private_room_players` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_ready` integer DEFAULT 0 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`room_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `private_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`variant` text NOT NULL,
	`puzzle` text NOT NULL,
	`solution` text NOT NULL,
	`cages` text NOT NULL,
	`max_players` integer NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`winner_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `private_rooms_code_unique` ON `private_rooms` (`code`);