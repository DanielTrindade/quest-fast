ALTER TABLE `combatants` ADD `controller_id` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `created_by` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `summoner_id` text;--> statement-breakpoint
ALTER TABLE `combatants` ADD `summon_concentration` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `initiative_mode` text DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `rounds_left` integer;--> statement-breakpoint
CREATE INDEX `combatants_controller_id_idx` ON `combatants` (`controller_id`);