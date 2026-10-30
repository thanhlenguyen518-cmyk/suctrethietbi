CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL
);

CREATE TABLE `job_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`until` integer NOT NULL
);

CREATE TABLE `mail_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL,
	`provider_id` text,
	`error` text
);
