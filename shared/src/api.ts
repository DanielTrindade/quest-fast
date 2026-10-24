import type { Role } from './role.ts';
import type { DieResult, RollMode } from './dice.ts';
import type { Ability, Skill } from './modifiers.ts';
import type { ArmorTraining, Coins, DeathSaves, HitDie, Size, Spell, SpellSlot } from './sheet.ts';
import type { ActiveCondition, COMBATANT_SOURCES, ENCOUNTER_STATUSES, HealthBand } from './combat.ts';

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

type AttackDetails = {
  name: string;
  /** Damage as a dice expression, e.g. "1d8+3". */
  damage: string;
  /** e.g. "Cortante"; empty when not informed. */
  damageType: string;
  notes: string;
};

/**
 * A row of "Armas e truques de dano", stored as structured text: the table
 * never derives it. The "Bônus Atq/CD" column holds one of two things: an
 * attack bonus (the character rolls 1d20 + bonus against the target's AC) or
 * a save DC (the target rolls a saving throw of an ability against it, and
 * there is no attack roll).
 */
export type Attack = AttackDetails & (
  | { kind: 'attack'; /** Attack roll bonus, e.g. +5. */ bonus: number }
  | { kind: 'save'; dc: number; saveAbility: Ability }
);

/**
 * What clients send. Older clients omit `kind` (an attack roll), the damage
 * type and the notes. A save may arrive without its ability so validation can
 * point at it; it is never stored that way.
 */
export type AttackInput = Pick<AttackDetails, 'name' | 'damage'> & Partial<Pick<AttackDetails, 'damageType' | 'notes'>> & (
  | { kind?: 'attack'; bonus: number }
  | { kind: 'save'; dc: number; saveAbility: Ability | null }
);

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

export type SessionEvent = RollSessionEvent | CombatSessionEvent | UnknownSessionEvent;

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

/**
 * What the server pushes. `combat.updated` carries the whole encounter as the
 * receiver may see it; the client drops one older than the `version` it has.
 */
export type SocketMessage =
  | { type: 'session.event'; event: SessionEvent }
  | { type: 'combat.updated'; encounter: EncounterView };

// --- Phase 2: combat and bestiary --------------------------------------------

/**
 * A bestiary entry of the campaign, typed by the master (no SRD). Combatants
 * copy its values, so editing it never changes an encounter in progress.
 */
export type StatblockInput = {
  name: string;
  size: Size;
  /** e.g. "Humanoide (goblinoide)"; empty when not informed. */
  creatureType: string;
  /** "1/4", "2"…; empty when not informed. */
  challengeRating: string;
  ac: number;
  hpAverage: number;
  /** Dice expression to roll each copy's hit points; empty for the average only. */
  hpFormula: string;
  /** Free text, e.g. "9 m, escalada 6 m". */
  speed: string;
  initiativeBonus: number;
  abilityScores: AbilityScores;
  attacks: AttackInput[];
  traits: string;
  actions: string;
  reactions: string;
};

export type Statblock = Omit<StatblockInput, 'attacks'> & {
  id: string;
  campaignId: string;
  attacks: Attack[];
  createdAt: string;
  updatedAt: string;
};

export type StatblockSummary = Pick<
  Statblock,
  'id' | 'name' | 'size' | 'creatureType' | 'challengeRating' | 'ac' | 'hpAverage' | 'hpFormula'
>;
export type StatblockResponse = { statblock: Statblock };
export type StatblockListResponse = { statblocks: StatblockSummary[] };

export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];
export type CombatantSource = (typeof COMBATANT_SOURCES)[number];

/**
 * A combatant as one viewer may see it, projected on the server. A field the
 * viewer may not know is `null`, never omitted by accident: a player gets
 * neither hit points, armor class nor initiative of a monster, only its
 * health band, and never sees a hidden combatant at all.
 */
export type CombatantView = {
  id: string;
  source: CombatantSource;
  /** Only for `source: 'character'`; the sheet holds its hit points. */
  characterId: string | null;
  /** The sheet's owner, so a player can find their own combatant. */
  ownerId: string | null;
  name: string;
  size: Size;
  /** Always false for a player, who never receives a hidden combatant. */
  hidden: boolean;
  initiative: number | null;
  /** True once initiative is set, even when its value is hidden. */
  hasInitiative: boolean;
  /** Master only: tie-breakers of the queue. */
  dexModifier: number | null;
  tieOrder: number | null;
  ac: number | null;
  hpMax: number | null;
  hpCurrent: number | null;
  hpTemp: number | null;
  healthBand: HealthBand;
  /** A monster or manual combatant at 0 hit points: its turn is skipped. */
  defeated: boolean;
  conditions: ActiveCondition[];
  concentrating: boolean;
};

export type EncounterSummaryView = {
  rounds: number;
  /** Names of the defeated the viewer may know about. */
  defeated: string[];
};

/**
 * An encounter as one viewer may see it. `combatants` come in queue order —
 * initiative first, then the ones still without it. When the active combatant
 * is hidden from a player, `activeCombatantId` is null and `activeHidden` says
 * it is someone else's turn.
 */
export type EncounterView = {
  id: string;
  campaignId: string;
  name: string;
  status: EncounterStatus;
  round: number;
  activeCombatantId: string | null;
  activeHidden: boolean;
  version: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  combatants: CombatantView[];
  /** Only once the encounter has ended. */
  summary: EncounterSummaryView | null;
};

export type EncounterListItem = Pick<EncounterView, 'id' | 'name' | 'status' | 'round' | 'createdAt' | 'endedAt'> & {
  combatantCount: number;
};

export type EncounterListResponse = { encounters: EncounterListItem[] };
export type EncounterResponse = { encounter: EncounterView };
/** A turn request that lost the race answers 409 with the current state. */
export type EncounterConflictResponse = ErrorResponse & { encounter: EncounterView };

export type HitPointMode = 'average' | 'rolled';

/** What the master sends to add combatants, during preparation or as reinforcement. */
export type CombatantInput =
  | { source: 'character'; characterId: string; hidden?: boolean }
  | { source: 'statblock'; statblockId: string; count: number; hp: HitPointMode; hidden?: boolean }
  | {
      source: 'manual';
      name: string;
      size?: Size;
      ac: number;
      hp: number;
      /** Added to the d20 when the initiative is rolled. */
      initiativeBonus?: number;
      initiative?: number | null;
      hidden?: boolean;
    };

/** The master's edits to a combatant; absent keys stay as they are. */
export type CombatantPatch = {
  name?: string;
  hidden?: boolean;
  /** Not for a character: the sheet holds it. */
  ac?: number;
  hpMax?: number;
};

/** No `value` rolls on the server; a `value` is typed by the master. */
export type InitiativeRequest = {
  value?: number;
  mode?: RollMode;
  /** Master only; a monster's roll is secret unless told otherwise. */
  secret?: boolean;
};

export type TurnRequest = {
  direction: 'next' | 'previous';
  /** The turn the client is looking at; a stale one answers 409. */
  expectedActiveCombatantId: string | null;
};

/** The master's order for combatants still tied after Dexterity. */
export type TieOrderRequest = { combatantIds: string[] };

export type CombatStartedPayload = { kind: 'combat.started'; encounterId: string; encounterName: string };
export type CombatEndedPayload = {
  kind: 'combat.ended';
  encounterId: string;
  encounterName: string;
  rounds: number;
  /** Stored whole; a player reads it without the hidden ones. */
  defeated: { name: string; hidden: boolean }[];
};

/** The start and the end of a combat; turn changes stay out of the feed. */
export type CombatSessionEvent = Omit<RollSessionEvent, 'type' | 'payload'> &
  (
    | { type: 'combat.started'; payload: CombatStartedPayload }
    | { type: 'combat.ended'; payload: CombatEndedPayload }
  );
