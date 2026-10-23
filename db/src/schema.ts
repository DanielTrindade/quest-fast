import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import {
  ABILITIES,
  ROLES,
  SIZES,
  type Ability,
  type ActiveCondition,
  type AbilityScores,
  type ArmorTraining,
  type Attack,
  type Coins,
  type DeathSaves,
  type HitDie,
  type Skill,
  type Spell,
  type SpellSlot,
} from '@quest-fast/shared';

/**
 * MVP phase 0. The schema grows by migration, never by retroactive edit —
 * the character, asset and feed tables below are phase 1; combat and world
 * tables come in the next phases.
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

// --- Phase 1 -----------------------------------------------------------------

/**
 * Uploads live on local disk behind this table (campaign, relative path, mime,
 * size). The same abstraction will hold the VTT's map images in a later change.
 */
export const assets = sqliteTable(
  'assets',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    uploadedById: text('uploaded_by_id')
      .notNull()
      .references(() => users.id),
    /** Relative path under the uploads directory; the served URL derives from it. */
    path: text('path').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [index('assets_campaign_id_idx').on(table.campaignId)],
);

/**
 * A D&D 5e sheet, born inside the campaign (decision 9). The owner edits it;
 * every campaign member can read it. Scores, skills and attacks are JSON.
 */
export const characters = sqliteTable(
  'characters',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    race: text('race').notNull(),
    class: text('class').notNull(),
    level: integer('level').notNull(),
    abilityScores: text('ability_scores', { mode: 'json' }).$type<AbilityScores>().notNull(),
    hp: integer('hp').notNull(),
    ac: integer('ac').notNull(),
    skills: text('skills', { mode: 'json' }).$type<Skill[]>().notNull(),
    saves: text('saves', { mode: 'json' }).$type<Ability[]>().notNull(),
    attacks: text('attacks', { mode: 'json' }).$type<Attack[]>().notNull(),
    features: text('features', { mode: 'json' }).$type<string[]>().notNull(),
    description: text('description').notNull().default(''),
    avatarAssetId: text('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    // Official D&D 2024 sheet. Every column has a constant default, which
    // SQLite requires to add it to a table that already has rows.
    subclass: text('subclass').notNull().default(''),
    background: text('background').notNull().default(''),
    alignment: text('alignment').notNull().default(''),
    experience: integer('experience').notNull().default(0),
    size: text('size', { enum: SIZES }).notNull().default('medium'),
    shield: integer('shield', { mode: 'boolean' }).notNull().default(false),
    /** Meters, as the Portuguese sheet writes it. */
    speed: real('speed').notNull().default(9),
    hitDie: integer('hit_die').$type<HitDie>().notNull().default(8),
    initiativeBonus: integer('initiative_bonus').notNull().default(0),
    passivePerceptionBonus: integer('passive_perception_bonus').notNull().default(0),
    expertise: text('expertise', { mode: 'json' }).$type<Skill[]>().notNull().default([]),
    armorTraining: text('armor_training', { mode: 'json' }).$type<ArmorTraining[]>().notNull().default([]),
    weaponProficiencies: text('weapon_proficiencies').notNull().default(''),
    toolProficiencies: text('tool_proficiencies').notNull().default(''),
    speciesTraits: text('species_traits', { mode: 'json' }).$type<string[]>().notNull().default([]),
    feats: text('feats', { mode: 'json' }).$type<string[]>().notNull().default([]),
    spellcastingAbility: text('spellcasting_ability', { enum: ABILITIES }),
    spellBonus: integer('spell_bonus').notNull().default(0),
    spellSlots: text('spell_slots', { mode: 'json' }).$type<SpellSlot[]>().notNull().default([]),
    spells: text('spells', { mode: 'json' }).$type<Spell[]>().notNull().default([]),
    appearance: text('appearance').notNull().default(''),
    languages: text('languages').notNull().default(''),
    equipment: text('equipment').notNull().default(''),
    attunedItems: text('attuned_items', { mode: 'json' }).$type<string[]>().notNull().default([]),
    coins: text('coins', { mode: 'json' }).$type<Coins>().notNull().default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
    // Session state, changed by the owner while playing. The migration that
    // adds `hp_current` fills it from `hp`, so existing sheets start full.
    hpCurrent: integer('hp_current').notNull().default(0),
    hpTemp: integer('hp_temp').notNull().default(0),
    hitDiceSpent: integer('hit_dice_spent').notNull().default(0),
    deathSaves: text('death_saves', { mode: 'json' }).$type<DeathSaves>().notNull().default({ successes: 0, failures: 0 }),
    heroicInspiration: integer('heroic_inspiration', { mode: 'boolean' }).notNull().default(false),
    // Phase 2: the sheet is the single source of truth for a character's
    // conditions and concentration, in and out of combat.
    conditions: text('conditions', { mode: 'json' }).$type<ActiveCondition[]>().notNull().default([]),
    concentrating: integer('concentrating', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [
    index('characters_campaign_id_idx').on(table.campaignId),
    index('characters_owner_id_idx').on(table.ownerId),
  ],
);

/**
 * The session feed: the realtime channel of the campaign. `secret` events are
 * written here for the master but never leave the server towards a player.
 */
export const sessionEvents = sqliteTable(
  'session_events',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull().default('roll'),
    secret: integer('secret', { mode: 'boolean' }).notNull().default(false),
    payload: text('payload', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [index('session_events_campaign_created_idx').on(table.campaignId, table.createdAt)],
);

export type AssetRow = typeof assets.$inferSelect;
export type CharacterRow = typeof characters.$inferSelect;
export type SessionEventRow = typeof sessionEvents.$inferSelect;

// --- Phase 2: combat and bestiary ---------------------------------------------

export const ENCOUNTER_STATUSES = ['preparing', 'active', 'ended'] as const;
export const COMBATANT_SOURCES = ['character', 'statblock', 'manual'] as const;

/**
 * The campaign's bestiary, typed by the master. Combatants copy its values,
 * so editing an entry never changes an encounter in progress.
 */
export const statblocks = sqliteTable(
  'statblocks',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    size: text('size', { enum: SIZES }).notNull().default('medium'),
    creatureType: text('creature_type').notNull().default(''),
    challengeRating: text('challenge_rating').notNull().default(''),
    ac: integer('ac').notNull(),
    hpAverage: integer('hp_average').notNull(),
    hpFormula: text('hp_formula').notNull().default(''),
    speed: text('speed').notNull().default(''),
    initiativeBonus: integer('initiative_bonus').notNull().default(0),
    abilityScores: text('ability_scores', { mode: 'json' }).$type<AbilityScores>().notNull(),
    attacks: text('attacks', { mode: 'json' }).$type<Attack[]>().notNull(),
    traits: text('traits').notNull().default(''),
    actions: text('actions').notNull().default(''),
    reactions: text('reactions').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [index('statblocks_campaign_id_idx').on(table.campaignId)],
);

/**
 * The turn is kept by identity (`activeCombatantId`), not by position, so
 * adding or removing a combatant never moves it to someone else. `version`
 * grows with every change and orders the realtime messages on the client.
 */
export const encounters = sqliteTable(
  'encounters',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status', { enum: ENCOUNTER_STATUSES }).notNull().default('preparing'),
    round: integer('round').notNull().default(0),
    // No foreign key: combatants reference the encounter, and the cycle would
    // only add ordering trouble. The server keeps it consistent.
    activeCombatantId: text('active_combatant_id'),
    version: integer('version').notNull().default(0),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    endedAt: integer('ended_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [
    index('encounters_campaign_id_idx').on(table.campaignId),
    // At most one active encounter per campaign; any number in preparation.
    uniqueIndex('encounters_one_active_idx')
      .on(table.campaignId)
      .where(sql`status = 'active'`),
  ],
);

/**
 * One participant of an encounter. Its `id` is stable: the VTT token will
 * anchor on it. A combatant from a character stores neither hit points, armor
 * class, conditions nor concentration — it reads and writes the sheet — so
 * those columns are null for it.
 */
export const combatants = sqliteTable(
  'combatants',
  {
    id: text('id').primaryKey(),
    encounterId: text('encounter_id')
      .notNull()
      .references(() => encounters.id, { onDelete: 'cascade' }),
    source: text('source', { enum: COMBATANT_SOURCES }).notNull(),
    characterId: text('character_id').references(() => characters.id, { onDelete: 'cascade' }),
    /** Where the values were copied from; kept only as a reference. */
    statblockId: text('statblock_id').references(() => statblocks.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    size: text('size', { enum: SIZES }).notNull().default('medium'),
    ac: integer('ac'),
    hpMax: integer('hp_max'),
    hpCurrent: integer('hp_current'),
    hpTemp: integer('hp_temp'),
    conditions: text('conditions', { mode: 'json' }).$type<ActiveCondition[]>(),
    concentrating: integer('concentrating', { mode: 'boolean' }),
    /** Initiative tie-breaker, copied from the sheet or the statblock. */
    dexModifier: integer('dex_modifier').notNull().default(0),
    initiative: integer('initiative'),
    /** The master's order among combatants still tied after Dexterity. */
    tieOrder: integer('tie_order').notNull().default(0),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    attacks: text('attacks', { mode: 'json' }).$type<Attack[]>().notNull().default([]),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (table) => [
    index('combatants_encounter_id_idx').on(table.encounterId),
    index('combatants_character_id_idx').on(table.characterId),
  ],
);

export type StatblockRow = typeof statblocks.$inferSelect;
export type EncounterRow = typeof encounters.$inferSelect;
export type CombatantRow = typeof combatants.$inferSelect;
