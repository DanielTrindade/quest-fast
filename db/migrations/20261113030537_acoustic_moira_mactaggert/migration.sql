CREATE TABLE `tokens` (
	`id` text PRIMARY KEY,
	`scene_id` text NOT NULL,
	`kind` text NOT NULL,
	`character_id` text,
	`combatant_id` text,
	`statblock_id` text,
	`label` text,
	`size` text,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_tokens_scene_id_scenes_id_fk` FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_tokens_character_id_characters_id_fk` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_tokens_combatant_id_combatants_id_fk` FOREIGN KEY (`combatant_id`) REFERENCES `combatants`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_tokens_statblock_id_statblocks_id_fk` FOREIGN KEY (`statblock_id`) REFERENCES `statblocks`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_scene_character_idx` ON `tokens` (`scene_id`,`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_scene_combatant_idx` ON `tokens` (`scene_id`,`combatant_id`);--> statement-breakpoint
CREATE INDEX `tokens_character_id_idx` ON `tokens` (`character_id`);--> statement-breakpoint
CREATE INDEX `tokens_combatant_id_idx` ON `tokens` (`combatant_id`);