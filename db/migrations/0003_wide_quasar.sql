CREATE TABLE `combatants` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`source` text NOT NULL,
	`character_id` text,
	`statblock_id` text,
	`name` text NOT NULL,
	`size` text DEFAULT 'medium' NOT NULL,
	`ac` integer,
	`hp_max` integer,
	`hp_current` integer,
	`hp_temp` integer,
	`conditions` text,
	`concentrating` integer,
	`dex_modifier` integer DEFAULT 0 NOT NULL,
	`initiative` integer,
	`tie_order` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`attacks` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statblock_id`) REFERENCES `statblocks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `combatants_encounter_id_idx` ON `combatants` (`encounter_id`);--> statement-breakpoint
CREATE INDEX `combatants_character_id_idx` ON `combatants` (`character_id`);--> statement-breakpoint
CREATE TABLE `encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`round` integer DEFAULT 0 NOT NULL,
	`active_combatant_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `encounters_campaign_id_idx` ON `encounters` (`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `encounters_one_active_idx` ON `encounters` (`campaign_id`) WHERE status = 'active';--> statement-breakpoint
CREATE TABLE `statblocks` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`size` text DEFAULT 'medium' NOT NULL,
	`creature_type` text DEFAULT '' NOT NULL,
	`challenge_rating` text DEFAULT '' NOT NULL,
	`ac` integer NOT NULL,
	`hp_average` integer NOT NULL,
	`hp_formula` text DEFAULT '' NOT NULL,
	`speed` text DEFAULT '' NOT NULL,
	`initiative_bonus` integer DEFAULT 0 NOT NULL,
	`ability_scores` text NOT NULL,
	`attacks` text NOT NULL,
	`traits` text DEFAULT '' NOT NULL,
	`actions` text DEFAULT '' NOT NULL,
	`reactions` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `statblocks_campaign_id_idx` ON `statblocks` (`campaign_id`);--> statement-breakpoint
ALTER TABLE `characters` ADD `conditions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `concentrating` integer DEFAULT false NOT NULL;