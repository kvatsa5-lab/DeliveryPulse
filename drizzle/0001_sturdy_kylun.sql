CREATE TABLE `improvements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`owner` text NOT NULL,
	`impact` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runbooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`product` text NOT NULL,
	`environment` text NOT NULL,
	`architecture` text NOT NULL,
	`approval` text NOT NULL,
	`owner` text NOT NULL,
	`reviewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`engineer` text NOT NULL,
	`skill` text NOT NULL,
	`rating` text NOT NULL,
	`evidence` text NOT NULL,
	`updated_at` text NOT NULL
);
