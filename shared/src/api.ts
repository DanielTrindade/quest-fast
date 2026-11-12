import type { Role } from './role.ts';
import type { DieResult, RollMode } from './dice.ts';
import type { Ability, Skill } from './modifiers.ts';
import type { ArmorTraining, Coins, DeathSaves, HitDie, Size, Spell, SpellSlot } from './sheet.ts';
import type { GridSettings } from './battlefield.ts';
import type { ActiveCondition, COMBATANT_SOURCES, CombatReminder, ENCOUNTER_STATUSES, HealthBand, HpOperation } from './combat.ts';

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

export type InviteViewer = 'anonymous' | 'guest' | 'member' | 'blocked';

export type InvitePreview = {
  code: string;
  campaignName: string;
  master: { name: string; avatarUrl: string | null };
  playerCount: number;
  viewer: InviteViewer;
  campaignId?: string;
};

export type CampaignMember = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
};

export type CampaignBan = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bannedAt: string;
};

export type MeResponse = { user: PublicUser };
export type CampaignsResponse = { campaigns: CampaignSummary[] };
export type MembersResponse = { members: CampaignMember[] };
export type BansResponse = { bans: CampaignBan[] };

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
  conditions: ActiveCondition[];
  concentrating: boolean;
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
  /** The whole list. The sheet sets no duration: one already counting in a fight is kept. */
  conditions?: ActiveCondition[];
  concentrating?: boolean;
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
  /** Only for a Constitution save that keeps concentration: the DC it had to beat. */
  concentrationDc?: number;
  /**
   * An attack's damage. Absent on a miss, and on an attack without a target
   * until its damage is rolled (as an event of its own).
   */
  damage?: DamageRoll;
  /** A natural 20 on an attack roll: the damage dice were doubled. */
  critical?: boolean;
  /** Who the attack was aimed at. A player never reads a monster's AC here. */
  target?: AttackTarget;
  /**
   * An attack against a save: no attack roll, the target rolls. The roll's
   * own `expression`/`dice`/`total` are then the damage.
   */
  save?: { dc: number; ability: Ability };
  /** Who attacked, kept so redaction never depends on a combatant still there. */
  attackerSource?: 'character' | 'monster';
  /**
   * An attack without a target: its damage may still be rolled, once, by who
   * attacked. A player never reads it on a monster's attack.
   */
  damageRollable?: { expression: string; damageType: string };
  /** Set once that damage was rolled. */
  damageRolled?: boolean;
  /** A damage roll made after its attack: the attack's event id. */
  damageOf?: string;
  /**
   * A monster's attack as a player reads it: the roll's `expression`, `dice`,
   * `modifier` and `total` are blanked and `natural` is gone, since with them
   * the bonus is a subtraction away; the damage keeps only its total. What
   * remains is what the master says at the table: hit or miss, critical and
   * damage.
   */
  redacted?: true;
};

export type DamageRoll = {
  /** As rolled: already doubled on a critical. */
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  /** e.g. "Cortante"; empty when the attack does not say. */
  damageType: string;
};

export type AttackTarget = {
  combatantId: string;
  name: string;
  /** Decides whether a player may read the AC. */
  source: 'character' | 'monster';
  hit: boolean;
  /** Removed for a player when the target is a monster or a manual combatant. */
  ac?: number;
};

export type SessionEvent = RollSessionEvent | CombatSessionEvent | UnknownSessionEvent;

/**
 * A roll event, the first kind the feed persisted. Combat added its own types
 * on the same envelope; the client renders an unknown type via the unknown
 * branch until a card exists. The battlefield adds no feed event.
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
  | { type: 'combat.updated'; encounter: EncounterView }
  /** Sent only to whoever could see the encounter: never one in preparation to a player. */
  | { type: 'combat.deleted'; encounterId: string }
  /**
   * The scene as the receiver may see it. A player only ever receives the one
   * open for the table; opening another scene sends it to everyone.
   */
  | { type: 'scene.updated'; scene: SceneView }
  /** The master closed the map, or deleted the scene that was open. */
  | { type: 'scene.closed'; sceneId: string };

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
  /** Always false for a player looking at a monster. */
  concentrating: boolean;
  /** Only for a character; a monster has none. */
  deathSaves: DeathSaves | null;
  /** Always empty for a player looking at a monster: a DC gives the damage away. */
  reminders: CombatReminder[];
  /** What it attacks with. Always empty for a player looking at a monster. */
  attacks: Attack[];
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
  /** The round of that turn: one combatant standing acts in every round. */
  expectedRound: number;
};

/** The master's order for combatants still tied after Dexterity. */
export type TieOrderRequest = { combatantIds: string[] };

/** A change by amount, never a final value: two at the same time both count. */
export type HpRequest = { operation: HpOperation; amount: number };

export type ConditionRequest = {
  /** Only for exhaustion: 1 to 6. */
  level?: number;
  roundsLeft?: number;
};

export type ConcentrationRequest = { concentrating: boolean };

/** No `failures` rolls on the server; `failures` records damage taken at 0 hit points. */
export type DeathSaveRequest = {
  failures?: 1 | 2;
  /** The reminder this answers, cleared along with it. */
  reminderId?: string;
  /** Only for a roll: advantage or disadvantage, from a feature or a spell. */
  mode?: RollMode;
};

export type ConcentrationSaveRequest = {
  reminderId: string;
  mode?: RollMode;
  /** Master only; a monster's roll is secret unless told otherwise. */
  secret?: boolean;
};

export type AttackRequest = {
  /** Position in the combatant's attacks. */
  attackIndex: number;
  /** Without one, only the attack roll is made; the damage comes later. */
  targetId?: string | null;
  mode?: RollMode;
  /** Master only; a monster's attack is secret unless told otherwise. */
  secret?: boolean;
};

/** Without an amount, the pending damage goes in whole, as rolled. */
export type ApplyDamageRequest = { amount?: number };

export type CombatStartedPayload = { kind: 'combat.started'; encounterId: string; encounterName: string };
export type CombatEndedPayload = {
  kind: 'combat.ended';
  encounterId: string;
  encounterName: string;
  rounds: number;
  /** Stored whole; a player reads it without the hidden ones. */
  defeated: { name: string; hidden: boolean }[];
};

/** Who an event is about. A hidden combatant's events are secret, even once revealed. */
type CombatantRef = {
  encounterId: string;
  combatantId: string;
  name: string;
  source: CombatantSource;
};

/**
 * A change of hit points. Stored whole; a player reading about a monster gets
 * neither the amount nor the hit points, only the band.
 */
export type CombatHitPointsPayload = CombatantRef & {
  /** `combat.defeated` replaces the damage of the hit that takes a monster down. */
  kind: 'combat.damage' | 'combat.heal' | 'combat.defeated';
  amount?: number;
  hpCurrent?: number;
  hpMax?: number;
  band: HealthBand;
  /**
   * Only the hit that took a character from standing to 0. The final hit
   * points cannot tell it: damage to one already down leaves 0 too.
   */
  fell?: true;
};

export type CombatConditionPayload = CombatantRef & {
  kind: 'combat.condition';
  /** `expired`: its duration ran out at the end of the combatant's turn. */
  action: 'applied' | 'removed' | 'expired';
  condition: ActiveCondition;
};

/** Only a character makes death saves; the numbers are the table's. */
export type CombatDeathSavePayload = CombatantRef & {
  kind: 'combat.deathSave';
  /** The face kept; absent when failures from damage taken at 0 were recorded. */
  d20?: number;
  /** Only under advantage or disadvantage: the mode and both faces, in order. */
  mode?: Exclude<RollMode, 'normal'>;
  rolls?: [number, number];
  failures?: 1 | 2;
  saves: DeathSaves;
  outcome: 'pending' | 'stable' | 'dead' | 'revived';
};

export type CombatPayload =
  | CombatStartedPayload
  | CombatEndedPayload
  | CombatHitPointsPayload
  | CombatConditionPayload
  | CombatDeathSavePayload;

/** What happens in a fight; turn changes stay out of the feed. */
export type CombatSessionEvent = Omit<RollSessionEvent, 'type' | 'payload'> &
  (
    | { type: 'combat.started'; payload: CombatStartedPayload }
    | { type: 'combat.ended'; payload: CombatEndedPayload }
    | { type: 'combat.damage' | 'combat.heal' | 'combat.defeated'; payload: CombatHitPointsPayload }
    | { type: 'combat.condition'; payload: CombatConditionPayload }
    | { type: 'combat.deathSave'; payload: CombatDeathSavePayload }
  );

export const COMBAT_EVENT_TYPES = [
  'combat.started',
  'combat.ended',
  'combat.damage',
  'combat.heal',
  'combat.defeated',
  'combat.condition',
  'combat.deathSave',
] as const satisfies readonly CombatSessionEvent['type'][];

// --- Phase 4: battlefield ------------------------------------------------------

/**
 * A scene as its receiver may see it, from the REST routes and the socket
 * alike. The map is served by URL; the client draws it at `mapWidth` ×
 * `mapHeight`, the space every coordinate is in. Tokens and fog arrive in
 * later deliveries.
 */
export type SceneView = {
  id: string;
  campaignId: string;
  name: string;
  mapUrl: string;
  mapWidth: number;
  mapHeight: number;
  grid: GridSettings;
  /** Grows with every saved change; the client drops an older one. */
  version: number;
  createdAt: string;
};

/** A row of the master's scene list. */
export type SceneSummary = Pick<SceneView, 'id' | 'name' | 'mapUrl' | 'mapWidth' | 'mapHeight' | 'createdAt'> & {
  /** Open for the table: the one the players see. */
  active: boolean;
};

/**
 * What the master changes on a scene (`PATCH`). Creating a scene and swapping
 * its map are multipart uploads instead: a `name` field and an `image` file.
 */
export type SceneInput = {
  name?: string;
  grid?: Partial<GridSettings>;
};

/** Opens a scene for the table, or closes the map with `null`. */
export type ActiveSceneRequest = { sceneId: string | null };

export type SceneListResponse = { scenes: SceneSummary[] };
export type SceneResponse = { scene: SceneView };
