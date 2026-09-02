CREATE TABLE `runbook_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`runbook_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runbook_attachments_object_key_unique` ON `runbook_attachments` (`object_key`);
--> statement-breakpoint
DELETE FROM `engagements` WHERE
  (`customer` = 'Apex Financial' AND `title` = 'Nexus Repository HA deployment') OR
  (`customer` = 'Northstar Health' AND `title` = 'Lifecycle onboarding') OR
  (`customer` = 'Orbit Commerce' AND `title` = 'Repository Firewall rollout') OR
  (`customer` = 'Luma Energy' AND `title` = 'Nexus upgrade planning');
