CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`uploaded_by_id` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assets_campaign_id_idx` ON `assets` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`race` text NOT NULL,
	`class` text NOT NULL,
	`level` integer NOT NULL,
	`ability_scores` text NOT NULL,
	`hp` integer NOT NULL,
	`ac` integer NOT NULL,
	`skills` text NOT NULL,
	`saves` text NOT NULL,
	`attacks` text NOT NULL,
	`features` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`avatar_asset_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`avatar_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `characters_campaign_id_idx` ON `characters` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `characters_owner_id_idx` ON `characters` (`owner_id`);--> statement-breakpoint
CREATE TABLE `session_events` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text DEFAULT 'roll' NOT NULL,
	`secret` integer DEFAULT false NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_events_campaign_created_idx` ON `session_events` (`campaign_id`,`created_at`);