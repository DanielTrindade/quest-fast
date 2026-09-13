ALTER TABLE `characters` ADD `subclass` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `background` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `alignment` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `experience` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `size` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `shield` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `speed` real DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `hit_die` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `initiative_bonus` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `passive_perception_bonus` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `expertise` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `armor_training` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `weapon_proficiencies` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `tool_proficiencies` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `species_traits` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `feats` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `spellcasting_ability` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `spell_bonus` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `spell_slots` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `spells` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `appearance` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `languages` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `equipment` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `attuned_items` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `coins` text DEFAULT '{"cp":0,"sp":0,"ep":0,"gp":0,"pp":0}' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `hp_current` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `hp_temp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `hit_dice_spent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `death_saves` text DEFAULT '{"successes":0,"failures":0}' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `heroic_inspiration` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Sheets written before the official sheet start rested: a DEFAULT cannot
-- read another column, so current hit points are filled from the maximum.
UPDATE `characters` SET `hp_current` = `hp`;
