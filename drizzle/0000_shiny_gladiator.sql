CREATE TABLE `engagements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer` text NOT NULL,
	`title` text NOT NULL,
	`products` text NOT NULL,
	`environment` text NOT NULL,
	`architecture` text NOT NULL,
	`status` text NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`engagement_id` integer NOT NULL,
	`week_of` text NOT NULL,
	`progress` text NOT NULL,
	`next_step` text NOT NULL,
	`risk` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` text NOT NULL
);
