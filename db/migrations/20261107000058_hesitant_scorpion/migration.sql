ALTER TABLE `combatants` ADD `constitution_modifier` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `reminders` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `death_save_round` integer;