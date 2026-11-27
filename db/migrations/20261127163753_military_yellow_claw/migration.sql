CREATE TABLE `scene_areas` (
	`id` text PRIMARY KEY,
	`scene_id` text NOT NULL,
	`shape` text NOT NULL,
	`size` real NOT NULL,
	`width` real NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`angle` real DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_by` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`anchor_token_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_scene_areas_scene_id_scenes_id_fk` FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_scene_areas_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_scene_areas_anchor_token_id_tokens_id_fk` FOREIGN KEY (`anchor_token_id`) REFERENCES `tokens`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `scene_areas_scene_id_idx` ON `scene_areas` (`scene_id`);--> statement-breakpoint
CREATE INDEX `scene_areas_anchor_token_id_idx` ON `scene_areas` (`anchor_token_id`);--> statement-breakpoint
CREATE INDEX `scene_areas_created_by_idx` ON `scene_areas` (`created_by`);