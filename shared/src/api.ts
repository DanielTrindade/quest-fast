import type { Role } from './role.ts';
import type { DieResult, RollMode } from './dice.ts';
import type { Ability, Skill } from './modifiers.ts';

/**
 * Contract between server and client. Dates travel as ISO 8601; formatting
 * for the table is the client's decision.
 */

export type ErrorResponse = { error: string };

export type PublicUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CampaignSummary = {
  id: string;
  name: string;
  description: string;
  role: Role;
  joinedAt: string;
};

/** `inviteCode` is only present when the reader is the master. */
export type CampaignDetail = {
  id: string;
  name: string;
  description: string;
  role: Role;
  inviteCode?: string;
};

export type CreatedCampaign = CampaignDetail & { inviteCode: string };

export type CampaignJoin = {
  id: string;
  name: string;
  role: Role;
};

export type CampaignMember = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
};

export type MeResponse = { user: PublicUser };
export type CampaignsResponse = { campaigns: CampaignSummary[] };
export type MembersResponse = { members: CampaignMember[] };

// --- Phase 1: characters, assets, dice and the session feed -----------------

export type AbilityScores = Record<Ability, number>;

/** Attacks are stored as structured text: the table never derives them. */
export type Attack = {
  name: string;
  /** Attack roll bonus, e.g. +5. */
  bonus: number;
  /** Damage as a dice expression, e.g. "1d8+3". */
  damage: string;
};

export type CharacterSheet = {
  id: string;
  campaignId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  race: string;
  class: string;
  level: number;
  abilityScores: AbilityScores;
  hp: number;
  ac: number;
  /** Skills the character is proficient in, from the fixed 5e list. */
  skills: Skill[];
  /** Abilities whose saving throw the character is proficient in. */
  saves: Ability[];
  attacks: Attack[];
  features: string[];
  description: string;
  avatarUrl: string | null;
  /** Kept so the editor can keep or replace the uploaded image. */
  avatarAssetId: string | null;
};

/** What the editor sends to create or update a sheet. */
export type CharacterInput = {
  name: string;
  race: string;
  class: string;
  level: number;
  abilityScores: AbilityScores;
  hp: number;
  ac: number;
  skills: Skill[];
  saves: Ability[];
  attacks: Attack[];
  features: string[];
  description: string;
  avatarAssetId?: string | null;
};

export type CharacterSummary = {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  ownerId: string;
  ownerName: string;
  avatarUrl: string | null;
};

export type CharacterListResponse = { characters: CharacterSummary[] };
export type CharacterResponse = { character: CharacterSheet };

export type Asset = {
  id: string;
  url: string;
};
export type AssetUploadResponse = { asset: Asset };

export type FreeRollRequest = {
  expression: string;
  mode?: RollMode;
  /** Only the master may roll secretly. */
  secret?: boolean;
};

export type LinkedRollRequest = {
  kind: 'attack' | 'check' | 'save';
  /** Index into the sheet's attacks; only for `kind: 'attack'`. */
  attackIndex?: number;
  /** Only for `kind: 'check'` and `kind: 'save'`. */
  ability?: Ability;
  advantage?: boolean;
};

export type RollPayload = {
  kind: 'roll';
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  mode: RollMode;
  natural?: 1 | 20;
  /** Absent for a free roll; present for rolls linked to a sheet. */
  rollKind?: 'attack' | 'check' | 'save';
  characterId?: string;
  characterName?: string;
  attackName?: string;
  ability?: Ability;
};

export type SessionEvent = {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  type: 'roll';
  /** True events never reach a player, in the feed or over the socket. */
  secret: boolean;
  payload: RollPayload;
  createdAt: string;
};

export type FeedResponse = { events: SessionEvent[] };
export type RollResponse = { event: SessionEvent };

/** The only message the server pushes today; combat arrives in phase 2. */
export type SocketMessage = {
  type: 'session.event';
  event: SessionEvent;
};
