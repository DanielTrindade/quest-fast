import type { Role } from './role.ts';
import type { DieResult, RollMode } from './dice.ts';
import type { Ability, Skill } from './modifiers.ts';
import type { ArmorTraining, Coins, DeathSaves, HitDie, Size, Spell, SpellSlot } from './sheet.ts';

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
  /** e.g. "Cortante"; empty when not informed. */
  damageType: string;
  notes: string;
};

/** Attacks sent by older clients may omit the type and notes. */
export type AttackInput = Omit<Attack, 'damageType' | 'notes'> & Partial<Pick<Attack, 'damageType' | 'notes'>>;

/**
 * The official D&D 2024 sheet. `race` is labelled "Espécie", `hp` is the
 * maximum, `features` are the class features and `description` is the history
 * and personality text.
 */
export type CharacterSheet = {
  id: string;
  campaignId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  race: string;
  class: string;
  subclass: string;
  background: string;
  alignment: string;
  level: number;
  experience: number;
  size: Size;
  abilityScores: AbilityScores;
  hp: number;
  ac: number;
  shield: boolean;
  speed: number;
  hitDie: HitDie;
  initiativeBonus: number;
  passivePerceptionBonus: number;
  /** Skills the character is proficient in, from the fixed 5e list. */
  skills: Skill[];
  /** Proficient skills that add the proficiency bonus twice. */
  expertise: Skill[];
  /** Abilities whose saving throw the character is proficient in. */
  saves: Ability[];
  armorTraining: ArmorTraining[];
  weaponProficiencies: string;
  toolProficiencies: string;
  attacks: Attack[];
  features: string[];
  speciesTraits: string[];
  feats: string[];
  spellcastingAbility: Ability | null;
  spellBonus: number;
  /** Nine circles, 1st to 9th. */
  spellSlots: SpellSlot[];
  spells: Spell[];
  appearance: string;
  description: string;
  languages: string;
  equipment: string;
  attunedItems: string[];
  coins: Coins;
  // Session state: changed by the owner through `/state` while playing.
  hpCurrent: number;
  hpTemp: number;
  hitDiceSpent: number;
  deathSaves: DeathSaves;
  heroicInspiration: boolean;
  avatarUrl: string | null;
  /** Kept so the editor can keep or replace the uploaded image. */
  avatarAssetId: string | null;
};

/**
 * What the editor sends to create or update a sheet. Everything added by the
 * official sheet is optional and defaults on the server, so older clients stay
 * valid. Session state is not part of it, except coins (starting gold).
 */
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
  attacks: AttackInput[];
  features: string[];
  description: string;
  avatarAssetId?: string | null;
  subclass?: string;
  background?: string;
  alignment?: string;
  experience?: number;
  size?: Size;
  shield?: boolean;
  speed?: number;
  hitDie?: HitDie;
  initiativeBonus?: number;
  passivePerceptionBonus?: number;
  expertise?: Skill[];
  armorTraining?: ArmorTraining[];
  weaponProficiencies?: string;
  toolProficiencies?: string;
  speciesTraits?: string[];
  feats?: string[];
  spellcastingAbility?: Ability | null;
  spellBonus?: number;
  /** Nine totals, 1st to 9th circle. */
  spellSlotTotals?: number[];
  spells?: Spell[];
  appearance?: string;
  languages?: string;
  equipment?: string;
  attunedItems?: string[];
  coins?: Coins;
};

/** A partial update of what changes during play; absent keys stay as they are. */
export type CharacterStateInput = {
  hpCurrent?: number;
  hpTemp?: number;
  hitDiceSpent?: number;
  deathSaves?: DeathSaves;
  heroicInspiration?: boolean;
  /** Nine spent counts, 1st to 9th circle. */
  spellSlotsSpent?: number[];
  coins?: Coins;
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
  /** Hit points and armor class: public to the table, no sheet needed. */
  hp: number;
  hpCurrent: number;
  hpTemp: number;
  ac: number;
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
  kind: 'attack' | 'check' | 'save' | 'skill' | 'initiative' | 'spellAttack';
  /** Index into the sheet's attacks; only for `kind: 'attack'`. */
  attackIndex?: number;
  /** Only for `kind: 'check'` and `kind: 'save'`. */
  ability?: Ability;
  /** Only for `kind: 'skill'`: the trained or untrained skill being tested. */
  skill?: Skill;
  /** Advantage and disadvantage apply only to a single d20. */
  mode?: RollMode;
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
  rollKind?: 'attack' | 'check' | 'save' | 'skill' | 'initiative' | 'spellAttack';
  characterId?: string;
  characterName?: string;
  attackName?: string;
  ability?: Ability;
  /** Only for `rollKind: 'skill'`: which skill was tested. */
  skill?: Skill;
};

export type SessionEvent = RollSessionEvent | UnknownSessionEvent;

/**
 * A roll event, the only kind the MVP persists. Phase 2 adds new event types
 * on the same channel (`token.moved`, `fog.updated`) without changing this
 * envelope; the client renders them via the unknown branch until a card exists.
 */
export type RollSessionEvent = {
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

/**
 * Any event type the current client does not have a card for. Carries enough
 * metadata to render a generic row without breaking the feed or silencing it.
 */
export type UnknownSessionEvent = {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  type: string;
  secret: boolean;
  payload: unknown;
  createdAt: string;
};

export type FeedResponse = { events: SessionEvent[]; nextCursor: string | null };
/** The roll endpoints always answer with a roll event. */
export type RollResponse = { event: RollSessionEvent };

/** The only message the server pushes today; combat arrives in phase 2. */
export type SocketMessage = {
  type: 'session.event';
  event: SessionEvent;
};
