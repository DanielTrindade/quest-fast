import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { ROLES } from '@quest-fast/shared';

/**
 * MVP phase 0. Character, combat and world tables come in the next phases;
 * the schema grows by migration, never by retroactive edit.
 */

const now = sql`(unixepoch())`;

/** The profile comes from Discord and is refreshed on every login. */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    discordId: text('discord_id').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [uniqueIndex('users_discord_id_idx').on(table.discordId)],
);

/**
 * The session lives on the server so that logout can truly invalidate it; the
 * cookie carries only the id.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    /** Visible only to the master; the read route omits it for a player. */
    inviteCode: text('invite_code').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [uniqueIndex('campaigns_invite_code_idx').on(table.inviteCode)],
);

/**
 * The single source of authorization: every campaign route resolves the role
 * here. The (campaign, user) pair is unique — there is no duplicate
 * membership.
 */
export const campaignMembers = sqliteTable(
  'campaign_members',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ROLES }).notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('campaign_members_campaign_user_idx').on(table.campaignId, table.userId),
    index('campaign_members_user_id_idx').on(table.userId),
  ],
);

/** Row types. The API-facing shapes live in `@quest-fast/shared`. */
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignMemberRow = typeof campaignMembers.$inferSelect;
