ALTER TABLE `characters` ADD `attacks_per_action` integer;--> statement-breakpoint
ALTER TABLE `combatants` ADD `speed` real DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `attacks_per_action` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `action_used` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `bonus_action_used` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `reaction_used` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `attacks_left` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `extra_actions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `dashes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `combatants` ADD `movement_used` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `statblocks` ADD `attacks_per_action` integer DEFAULT 1 NOT NULL;