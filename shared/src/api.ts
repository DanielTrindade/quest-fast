import type { Role } from './role.ts';
import type { DieResult, RollMode } from './dice.ts';
import type { BonusRoll, RollBonusInput } from './roll-bonus.ts';
import type { Ability, Skill } from './modifiers.ts';
import type { ArmorTraining, Coins, DeathSaves, HitDie, Size, Spell, SpellSlot } from './sheet.ts';
import type { AreaColor, AreaGeometry, AreaShape } from './areas.ts';
import type { GridSettings, TokenKind } from './battlefield.ts';
import type { SceneFog } from './fog.ts';
import type { ChatMessageView } from './chat.ts';
import type { AttackCost, TurnBudget, TurnSpend } from './turn.ts';
import type { SaveBonuses, SaveEffect, SaveRoll } from './attack.ts';
import type { ActiveCondition, COMBATANT_SOURCES, CombatReminder, ENCOUNTER_STATUSES, HealthBand, HpOperation } from './combat.ts';
import type { CombatEffect, CombatEffectInput, CombatEffectSummary } from './effects.ts';

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
  /**
   * Damage as a dice expression, e.g. "1d8+3". Empty only on a save that
   * deals no damage (Graxa): the target suffers only its effect.
   */
  damage: string;
  /** e.g. "Cortante"; empty when not informed. */
  damageType: string;
  notes: string;
  /**
   * How far it reaches, as the sheet writes it ("1,5 m", "18 m", "6/18 m");
   * empty when not informed. Text, like a spell's range: the table reads it.
   */
  range: string;
  /** What using it spends on its user's turn. */
  cost: AttackCost;
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
  | { kind: 'save'; dc: number; saveAbility: Ability; /** What a target that passes takes. */ onSave: SaveEffect }
);

/**
 * What clients send. Older clients omit `kind` (an attack roll), the damage
 * type, the notes, the range and the cost (`defaultAttackCost` of the kind). A save may
 * arrive without its ability so validation can point at it; it is never
 * stored that way.
 */
export type AttackInput = Pick<AttackDetails, 'name' | 'damage'> & Partial<Pick<AttackDetails, 'damageType' | 'notes' | 'range' | 'cost'>> & (
  | { kind?: 'attack'; bonus: number }
  | { kind: 'save'; dc: number; saveAbility: Ability | null; /** `half` when absent. */ onSave?: SaveEffect }
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
  /** Attacks of one Attack action as the sheet sets it; null reads them from the class and level. */
  attacksPerAction: number | null;
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
  /** The one character the owner brings to this campaign's table. */
  active: boolean;
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
  /** Null (or absent) reads the attacks from the class and level. */
  attacksPerAction?: number | null;
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
  active: boolean;
};

export type CharacterListResponse = { characters: CharacterSummary[] };
export type CharacterResponse = { character: CharacterSheet };

/** A sheet in the account gallery, with the campaign it belongs to. */
export type MyCharacter = CharacterSheet & { campaignName: string };
export type MyCharacterListResponse = { characters: MyCharacter[] };

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
  /** The situational modifier, as typed: `roll` on the d20, `damage` on a save row's damage. */
  bonus?: RollBonusInput;
};

export type RollPayload = {
  kind: 'roll';
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  mode: RollMode;
  natural?: 1 | 20;
  /**
   * The situational modifier on this roll, rolled apart and already in the
   * total. On a save row the roll is the damage, and this is the damage's.
   */
  bonus?: BonusRoll;
  /** Absent for a free roll; present for rolls linked to a sheet. */
  rollKind?: 'attack' | 'check' | 'save' | 'skill' | 'initiative' | 'spellAttack';
  characterId?: string;
  characterName?: string;
  attackName?: string;
  /** The attack's range as it was when used; absent when the row had none. */
  attackRange?: string;
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
  /** Who an attack roll was aimed at. A player never reads a monster's AC here. */
  target?: AttackTarget;
  /**
   * Who a save row reached, each with its own save and the damage it keeps.
   * A save stored before the area existed has `target` instead. A player's
   * copy leaves out the targets that were hidden.
   */
  targets?: AttackTarget[];
  /**
   * An attack against a save: no attack roll, the target rolls. The roll's
   * own `expression`/`dice`/`total` are then the damage. A save without
   * damage (Graxa) rolls nothing: those are empty and `damage` is absent.
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
  /** With the situational modifier, never below 0. */
  total: number;
  /** e.g. "Cortante"; empty when the attack does not say. */
  damageType: string;
  /** The situational modifier on the damage, already in the total. */
  bonus?: BonusRoll;
};

export type AttackTarget = {
  combatantId: string;
  name: string;
  /** Decides whether a player may read the AC. */
  source: 'character' | 'monster';
  hit: boolean;
  /** Removed for a player when the target is a monster or a manual combatant. */
  ac?: number;
  /**
   * Only on an attack against a save: the target's save, rolled by the
   * server. A player reading about a monster gets only `success`: with the DC,
   * the die and the total give the bonus away.
   */
  save?: SaveRoll | { success: boolean };
  /** Only on a save row with damage: what this target keeps, after its save. */
  damage?: number;
  /** Hidden from the players when the attack was made: their copy leaves it out. */
  hidden?: true;
};

export type SessionEvent = RollSessionEvent | CombatSessionEvent | SpellCastSessionEvent | UnknownSessionEvent;

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
 * A spell cast from the sheet: the slot it took (null for a ritual) and
 * whether it asks for concentration. The whole table reads it.
 */
export type SpellCastPayload = {
  kind: 'spell.cast';
  characterId: string;
  characterName: string;
  spellName: string;
  /** The spell's own circle. */
  spellLevel: number;
  /** The slot spent, at or above `spellLevel`; null when cast as a ritual. */
  circle: number | null;
  concentration: boolean;
};

export type SpellCastSessionEvent = Omit<RollSessionEvent, 'type' | 'payload'> & { type: 'spell.cast'; payload: SpellCastPayload };

/** Casting a spell of the sheet. `spellName` guards against a list edited meanwhile. */
export type CastSpellRequest = { spellIndex: number; spellName: string } & ({ circle: number } | { ritual: true });

/** The sheet as the cast left it, and the feed event it recorded. */
export type CastSpellResponse = { character: CharacterSheet; event: SpellCastSessionEvent };

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
 * Close code for a socket whose user is no longer a member of the campaign.
 * In the private 4000 range, echoing the 404 the REST routes give non-members.
 * The client stops reconnecting on it: retrying cannot bring access back.
 */
export const NOT_A_MEMBER_CLOSE_CODE = 4404;

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
  | { type: 'scene.closed'; sceneId: string }
  /**
   * A sheet of the campaign was created, changed, deleted or became the active
   * one. A hint with no data: the client asks the server for the roster again.
   */
  | { type: 'characters.changed' }
  /**
   * Where a token is while someone drags it, about 30 times a second. Never
   * saved: the drop arrives as `scene.updated`. Sent only to whoever sees the
   * token; `ts` is the server's clock, for the receiver's interpolation.
   */
  | { type: 'token.moving'; tokenId: string; x: number; y: number; ts: number }
  /**
   * A reference area someone is drawing on the open scene (#113), never
   * saved. `area: null` clears it at once; `done` means it was let go and
   * stays `AREA_LIMITS.previewLingerMs`. Without news for
   * `AREA_LIMITS.previewStaleMs` while not done, the receiver drops it: a
   * master's area that goes under the fog simply stops reaching a player.
   */
  | {
      type: 'area.previewing';
      sceneId: string;
      by: { userId: string; name: string };
      area: AreaGeometry | null;
      done: boolean;
      ts: number;
    }
  /** A new message of the table chat, to every member. */
  | { type: 'chat.message'; message: ChatMessageView }
  /** A chat message was removed: its text is never sent again. */
  | { type: 'chat.removed'; messageId: string };

/**
 * What the client may send over the socket: the position of the token it is
 * dragging, only while it holds the lock (`POST …/grab`), and the reference
 * area it is drawing on the scene open for the table (`area: null` clears it,
 * `done` lets it go). Anything else goes through REST.
 */
export type ClientSocketMessage =
  | { type: 'token.move'; tokenId: string; x: number; y: number }
  | { type: 'area.preview'; sceneId: string; area: AreaGeometry | null; done: boolean };

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
  /** Proficient saves with the book's bonus; the others roll the ability modifier. Empty when absent. */
  saveBonuses?: SaveBonuses;
  /** Multiattack: attacks of one Attack action. 1 when absent. */
  attacksPerAction?: number;
  /** An image uploaded to `/assets`; null removes it, absent keeps it. */
  imageAssetId?: string | null;
};

export type Statblock = Omit<StatblockInput, 'attacks' | 'attacksPerAction' | 'imageAssetId' | 'saveBonuses'> & {
  attacksPerAction: number;
  saveBonuses: SaveBonuses;
  imageAssetId: string | null;
  /** Where the browser loads the image from; its tokens show it too. */
  imageUrl: string | null;
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
  /** Under the effects (Shield of Faith). */
  ac: number | null;
  /** Under the effects (Aid). */
  hpMax: number | null;
  hpCurrent: number | null;
  hpTemp: number | null;
  healthBand: HealthBand;
  /** A monster or manual combatant at 0 hit points: its turn is skipped. */
  defeated: boolean;
  conditions: ActiveCondition[];
  /** Whole on an ally; on a monster, a player gets only each name. */
  effects: CombatEffectView[];
  /** Always false for a player looking at a monster. */
  concentrating: boolean;
  /** Only for a character; a monster has none. */
  deathSaves: DeathSaves | null;
  /** The death save of this round was already rolled: a player rolls one per round. */
  deathSaveRolled: boolean;
  /** Always empty for a player looking at a monster: a DC gives the damage away. */
  reminders: CombatReminder[];
  /** What it attacks with. Always empty for a player looking at a monster. */
  attacks: Attack[];
  /** Walking speed in metres, before conditions. Null for a player looking at a monster. */
  speed: number | null;
  /** Attacks of one Attack action. Null for a player looking at a monster. */
  attacksPerAction: number | null;
  /** What is left of its turn: for the master, and for the owner of the character. */
  turn: TurnView | null;
};

/** An effect as a viewer sees it: whole, or only its name (`modifiers` tells which). */
export type CombatEffectView = CombatEffect | CombatEffectSummary;

/** Applies an effect to a combatant; one of the same name is replaced. */
export type EffectRequest = CombatEffectInput;

/**
 * A combatant's turn as the server counts it (the reaction: since its own
 * turn last began), with the speed its conditions leave and the metres it
 * still has.
 */
export type TurnView = TurnBudget & {
  /** After effects (Longstrider, Slow) and conditions (Grappled, Restrained, Exhaustion). */
  speed: number;
  movementLeft: number;
  attacksPerAction: number;
};

/**
 * Spends a part of the turn, for the master or the owner on their turn (the
 * reaction at any time). The master also gives back what was spent and
 * grants an extra action (Action Surge, Haste).
 */
export type TurnEconomyRequest =
  | { spend: Exclude<TurnSpend, 'attack'> }
  | { refund: Exclude<TurnSpend, 'attack'> }
  | { grant: 'action' };

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

/**
 * A free token copied from the bestiary joins the encounter, sent to the same
 * route as `CombatantInput`: a copy of its entry, and the token stands for it.
 */
export type TokenJoinInput = { source: 'token'; tokenId: string; hp: HitPointMode };

/** The master's edits to a combatant; absent keys stay as they are. */
export type CombatantPatch = {
  name?: string;
  hidden?: boolean;
  /** Not for a character: the sheet holds it. */
  ac?: number;
  hpMax?: number;
  /** Metres. Not for a character: the sheet holds it. */
  speed?: number;
  /** Not for a character: the sheet holds it. */
  attacksPerAction?: number;
};

/** No `value` rolls on the server; a `value` is typed by the master. */
export type InitiativeRequest = {
  value?: number;
  mode?: RollMode;
  /** Only `roll` counts: on the rolled d20, never on a typed value. */
  bonus?: RollBonusInput;
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
  /** Only `roll` counts: on the save's d20. */
  bonus?: RollBonusInput;
  /** Master only; a monster's roll is secret unless told otherwise. */
  secret?: boolean;
};

export type AttackRequest = {
  /** Position in the combatant's attacks. */
  attackIndex: number;
  /**
   * Without any, only the attack roll is made; the damage comes later. More
   * than one only on a save row (an area). Each target enters once.
   */
  targetIds?: string[];
  /** What older clients send: one target, read as `targetIds: [targetId]`. */
  targetId?: string | null;
  mode?: RollMode;
  /** `roll` on the attack roll, `damage` on the damage; a save row has no roll of its own. */
  bonus?: RollBonusInput;
  /** Master only; a monster's attack is secret unless told otherwise. */
  secret?: boolean;
};

/** The damage of an attack without a target, rolled later: with the modifier of that moment. */
export type DamageRollRequest = { bonus?: Pick<RollBonusInput, 'damage'> };

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
 * A change of hit points. The whole table reads it, a monster's numbers
 * included: the table follows the hit points of what it fights.
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

/**
 * A temporary effect put on, taken off or run out. Only its name travels: on
 * a monster, the numbers are the master's.
 * `expired`: its duration ran out, or the concentration holding it ended.
 */
export type CombatEffectPayload = CombatantRef & {
  kind: 'combat.effect';
  action: 'applied' | 'removed' | 'expired';
  effect: CombatEffectSummary;
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
  | CombatEffectPayload
  | CombatDeathSavePayload;

/** What happens in a fight; turn changes stay out of the feed. */
export type CombatSessionEvent = Omit<RollSessionEvent, 'type' | 'payload'> &
  (
    | { type: 'combat.started'; payload: CombatStartedPayload }
    | { type: 'combat.ended'; payload: CombatEndedPayload }
    | { type: 'combat.damage' | 'combat.heal' | 'combat.defeated'; payload: CombatHitPointsPayload }
    | { type: 'combat.condition'; payload: CombatConditionPayload }
    | { type: 'combat.effect'; payload: CombatEffectPayload }
    | { type: 'combat.deathSave'; payload: CombatDeathSavePayload }
  );

export const COMBAT_EVENT_TYPES = [
  'combat.started',
  'combat.ended',
  'combat.damage',
  'combat.heal',
  'combat.defeated',
  'combat.condition',
  'combat.effect',
  'combat.deathSave',
] as const satisfies readonly CombatSessionEvent['type'][];

// --- Phase 4: battlefield ------------------------------------------------------

/**
 * A scene as its receiver may see it, from the REST routes and the socket
 * alike. The map is served by URL; the client draws it at `mapWidth` ×
 * `mapHeight`, the space every coordinate is in, the fog included.
 */
export type SceneView = {
  id: string;
  campaignId: string;
  name: string;
  mapUrl: string;
  mapWidth: number;
  mapHeight: number;
  grid: GridSettings;
  /** Open for the table. Always true for a player, who sees no other scene. */
  active: boolean;
  /**
   * The same for every viewer: the master draws it see-through, a player
   * opaque. What it covers is not only drawn over: a player never receives
   * a token that is not a character's under it.
   */
  fog: SceneFog;
  /** Only the tokens the receiver may see: a player never gets a hidden one. */
  tokens: TokenView[];
  /**
   * The persistent area templates the receiver may see (`isAreaVisible`):
   * a player never gets a hidden one, one following a token they do not
   * get, nor one of the master's with its origin under the fog.
   */
  areas: AreaView[];
  /** Grows with every saved change, opening and closing included; the client drops an older one. */
  version: number;
  createdAt: string;
};

/**
 * A token on a scene, with its name and size already read from the origin
 * (the sheet, the combatant, or its own for a free token).
 */
export type TokenVitality = 'up' | 'down' | 'defeated';

export type TokenView = {
  id: string;
  kind: TokenKind;
  name: string;
  size: Size;
  /**
   * The character's avatar, or the image of the bestiary entry a creature
   * came from; null otherwise, drawn with `initials`.
   */
  avatarUrl: string | null;
  /**
   * `down`: a character at 0 hit points, still making death saves.
   * `defeated`: a creature of the fight at 0 hit points. A player learns no
   * more than the health band already tells. A free token is always `up`.
   */
  vitality: TokenVitality;
  /** Fallback when there is no avatar, or while it loads. */
  initials: string;
  characterId: string | null;
  combatantId: string | null;
  /** The encounter of a combatant's token. Master only: always null for a player. */
  encounterId: string | null;
  /** The bestiary entry a free token was copied from, kept as a reference. */
  statblockId: string | null;
  /** The player who may move it besides the master: the owner of the character. */
  ownerId: string | null;
  /** Hidden by the master. Always false for a player, who never receives one. */
  hidden: boolean;
  /**
   * The combatant behind the token is hidden in the encounter: the players
   * do not receive the token either. Lets the master's "ver como jogador"
   * apply the server's rule whole. Always false for a player.
   */
  combatantHidden: boolean;
  /** Centre of the token, in map pixels. */
  x: number;
  y: number;
  /** Someone holds the lock and is dragging it. */
  movingBy: { userId: string; name: string } | null;
  /**
   * How far it walks, in metres: `left` this turn in a fight, the whole speed
   * outside one. Null when there is none to show, or the viewer may not know
   * it (a player looking at a creature).
   */
  reach: { speed: number; left: number } | null;
};

/**
 * What the master sends to put a token on the scene, at its centre (x, y):
 * the client picks the middle of the area in view; the server snaps it. A
 * bestiary entry becomes a free token with that entry's name and size.
 */
export type TokenInput = { x: number; y: number } & (
  | { kind: 'character'; characterId: string }
  | { kind: 'combatant'; combatantId: string }
  | { kind: 'statblock'; statblockId: string }
  | { kind: 'free'; label: string; size: Size }
);

/**
 * Puts every combatant of an encounter that is not on the scene yet, in a row
 * from (x, y). A character in the encounter is placed as its character token.
 */
export type PlaceEncounterRequest = { encounterId: string; x: number; y: number };

/**
 * A change to a token. Moving is open to whoever may move it (and releases
 * their lock); hiding and renaming a free token are the master's.
 */
export type TokenPatch = {
  x?: number;
  y?: number;
  /** Master only: move the combatant whose turn it is without spending its movement. */
  free?: boolean;
  hidden?: boolean;
  /** Only on a free token. */
  label?: string;
};

/** 409 when someone else holds the lock on the token. */
export type TokenLockedResponse = ErrorResponse & { movingBy: { userId: string; name: string } };

/**
 * A persistent area template on a scene (#113), as its receiver may see it.
 * Measures in metres, origin in map pixels: an area following a token is
 * drawn at the token's live position instead of (x, y).
 */
export type AreaView = {
  id: string;
  shape: AreaShape;
  /** Radius, length or edge, in metres. */
  size: number;
  /** Metres across a line; 1,5 m for any other shape. */
  width: number;
  x: number;
  y: number;
  /** Degrees clockwise from east. */
  angle: number;
  name: string;
  /** From the palette; `tint` because the client's lint reads any `color` prop as a raw colour. */
  tint: AreaColor;
  /** Who made it: they may move and remove it, besides the master. */
  createdBy: { userId: string; name: string };
  /** Hidden by the master. Always false for a player, who never receives one. */
  hidden: boolean;
  /** The token it follows; a player only receives it while they receive that token. */
  anchorTokenId: string | null;
};

/** A row of the master's scene list. */
export type SceneSummary = Pick<SceneView, 'id' | 'name' | 'mapUrl' | 'mapWidth' | 'mapHeight' | 'active' | 'createdAt'>;

/**
 * What the master changes on a scene (`PATCH`). Creating a scene and swapping
 * its map are multipart uploads instead: a `name` field and an `image` file.
 */
export type SceneInput = {
  name?: string;
  grid?: Partial<GridSettings>;
  /** Turning the fog off keeps the revealed area: on again, it is as it was. */
  fogEnabled?: boolean;
};

/*
 * The master reveals or hides a shape with `POST …/scenes/:sceneId/fog`,
 * a `FogOperation` (`validateFogOperation`), and gets the `SceneResponse`.
 */

/** Opens a scene for the table, or closes the map with `null`. */
export type ActiveSceneRequest = { sceneId: string | null };

export type SceneListResponse = { scenes: SceneSummary[] };
export type SceneResponse = { scene: SceneView };
