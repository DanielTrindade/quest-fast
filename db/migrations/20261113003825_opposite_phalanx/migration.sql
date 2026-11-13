ALTER TABLE `characters` ADD `active` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- A player with several sheets in a campaign brings the one changed last.
UPDATE `characters` SET `active` = 1 WHERE `id` = (
  SELECT `latest`.`id` FROM `characters` AS `latest`
  WHERE `latest`.`campaign_id` = `characters`.`campaign_id` AND `latest`.`owner_id` = `characters`.`owner_id`
  ORDER BY `latest`.`updated_at` DESC, `latest`.`created_at` DESC, `latest`.`id` DESC
  LIMIT 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_one_active_idx` ON `characters` (`campaign_id`,`owner_id`) WHERE active = 1;
