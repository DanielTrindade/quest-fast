CREATE TABLE `scenes` (
	`id` text PRIMARY KEY,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`map_asset_id` text NOT NULL,
	`map_width` integer NOT NULL,
	`map_height` integer NOT NULL,
	`grid_enabled` integer DEFAULT true NOT NULL,
	`grid_cell_size` real NOT NULL,
	`grid_offset_x` real DEFAULT 0 NOT NULL,
	`grid_offset_y` real DEFAULT 0 NOT NULL,
	`snap_to_grid` integer DEFAULT true NOT NULL,
	`fog_enabled` integer DEFAULT false NOT NULL,
	`fog_revealed` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_scenes_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_scenes_map_asset_id_assets_id_fk` FOREIGN KEY (`map_asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `active_scene_id` text;--> statement-breakpoint
CREATE INDEX `scenes_campaign_id_idx` ON `scenes` (`campaign_id`);