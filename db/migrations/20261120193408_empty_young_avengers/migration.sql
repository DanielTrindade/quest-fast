CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`mentions` text NOT NULL,
	`reply_to_id` text,
	`removed_at` integer,
	`removed_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_chat_messages_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_chat_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_chat_messages_reply_to_id_chat_messages_id_fk` FOREIGN KEY (`reply_to_id`) REFERENCES `chat_messages`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_chat_messages_removed_by_users_id_fk` FOREIGN KEY (`removed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_messages_campaign_created_idx` ON `chat_messages` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_messages_reply_to_idx` ON `chat_messages` (`reply_to_id`);