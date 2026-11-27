ALTER TABLE `combatants` ADD `summoned` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `combatants` SET `summoned` = 1 WHERE `summoner_id` IS NOT NULL OR (`controller_id` IS NOT NULL AND `created_by` = `controller_id`);
