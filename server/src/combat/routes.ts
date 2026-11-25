import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { Hono, type Context as HonoContext } from 'hono';
import { characters, combatants, encounters, scenes, statblocks, tokens, type EncounterRow } from '@quest-fast/db';
import {
  COMBAT_LIMITS as C,
  EFFECT_LIMITS,
  ENCOUNTER_LIMITS as E,
  EXHAUSTION_MAX,
  HP_OPERATIONS,
  STATBLOCK_LIMITS as S,
  abilityModifier,
  applyHpChange,
  damageReminders,
  deathSaveFailure,
  deathSaveOutcome,
  deathSaveStatus,
  effectiveHpMax,
  hasPreviousTurn,
  initiative as sheetInitiative,
  isCondition,
  isDefeated,
  isHit,
  isRollMode,
  isSize,
  keepsConcentration,
  nextTurn,
  pendingReminders,
  numberCopies,
  parseEffectInput,
  previousTurn,
  removeCondition,
  BONUS_TOO_BIG,
  bonusFits,
  readRollBonus,
  rollAttackHit,
  rollTest,
  type ParsedBonus,
  rollDamage,
  hasDamage,
  noRoll,
  rollDice,
  setCondition,
  setEffect,
  startTurnEffects,
  tickEffects,
  TURN_LIMITS,
  grantAction,
  isAttacksPerAction,
  isSpeed,
  refundTurn,
  spendTurn,
  speedFromText,
  tickConditions,
  attackSpend,
  damageAfterSave,
  failsSaveOutright,
  rollSave,
  saveConditions,
  saveModifiers,
  storedAttack,
  type AttackCost,
  type ActiveCondition,
  type CombatEffect,
  healthBand,
  type CombatPayload,
  type CombatReminder,
  type DeathSaves,
  type EncounterListItem,
  type HpOperation,
  type RollMode,
  type RollPayload,
  type SaveRoll,
  type Attack,
  type SessionEvent,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { recordCombatEvent, recordRollEvent } from '../events/feed.ts';
import type { Viewer } from '../events/hub.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { boundedInteger, shortText } from '../validation.ts';
import { releaseTurnDrags } from '../scenes/fight.ts';
import { bumpScenes, publishScenes, scenesShowing } from '../scenes/store.ts';
import { clearEffects, settleEffects, writeEffects } from './effects.ts';
import { projectEncounter } from './projection.ts';
import { attacksOf, findEncounter, loadEncounter, queueOrder, saveModifierOf, turnOrder, type Executor, type LoadedCombatant, type LoadedEncounter } from './state.ts';
import { beginTurn, budgetOf, writeBudget } from './turn.ts';

type Status = 403 | 404 | 409 | 422;

/**
 * Why a combat request was refused. Thrown inside the transaction, so nothing
 * it touched is kept. A stale turn (409) also answers with the current state.
 */
class Refusal extends Error {
  readonly status: Status;
  readonly withState: boolean;

  constructor(status: Status, message: string, withState = false) {
    super(message);
    this.status = status;
    this.withState = withState;
  }
}

function refuse(status: Status, message: string, withState = false): never {
  throw new Refusal(status, message, withState);
}

const MASTER_ONLY = 'Ação permitida apenas ao mestre.';
const NOT_FOUND = 'Encontro não encontrado.';
const COMBATANT_NOT_FOUND = 'Combatente não encontrado.';

type Mutation = {
  tx: Executor;
  loaded: LoadedEncounter;
  viewer: Viewer;
  /** Feed events to publish once the transaction commits. */
  events: SessionEvent[];
  /** Sheets this change wrote: every other open encounter of theirs is published too. */
  characters: Set<string>;
  /** Scenes this change wrote beyond those showing the encounter: a token that joined it. */
  scenes: Set<string>;
  userName: string;
};

function source(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

function requireMaster(viewer: Viewer) {
  if (viewer.role !== 'master') refuse(403, MASTER_ONLY);
}

function requireOpen(encounter: EncounterRow) {
  if (encounter.status === 'ended') refuse(409, 'Este combate já terminou.');
}

/** A combatant the viewer may know about; a hidden one does not exist for a player. */
function findCombatant(mutation: Mutation, combatantId: string): LoadedCombatant {
  const combatant = mutation.loaded.combatants.find((candidate) => candidate.row.id === combatantId);
  if (!combatant || (combatant.row.hidden && mutation.viewer.role !== 'master')) refuse(404, COMBATANT_NOT_FOUND);
  return combatant;
}

function setEncounter(mutation: Mutation, changes: Partial<EncounterRow>) {
  mutation.tx.update(encounters).set(changes).where(eq(encounters.id, mutation.loaded.encounter.id)).run();
  // Whoever takes the turn starts it whole, going back included.
  if (changes.activeCombatantId !== undefined) beginTurn(mutation.tx, changes.activeCombatantId);
}

function rollInitiative(
  mutation: Mutation,
  combatant: LoadedCombatant,
  options: { mode: RollMode; secret: boolean; extra?: ParsedBonus },
) {
  const { row, sheet } = combatant;
  const bonus = sheet ? sheetInitiative(sheet) : row.dexModifier + row.initiativeBonus;
  const result = rollTestWith(bonus, options.mode, options.extra);
  mutation.tx.update(combatants).set({ initiative: result.total }).where(eq(combatants.id, row.id)).run();
  mutation.events.push(
    recordRollEvent(mutation.tx, {
      campaignId: mutation.loaded.encounter.campaignId,
      userId: mutation.viewer.userId,
      userName: mutation.userName,
      // A hidden combatant's roll would give it away, and so would any roll
      // of an encounter the players cannot see yet.
      secret: options.secret || row.hidden || mutation.loaded.encounter.status === 'preparing',
      payload: {
        kind: 'roll',
        ...result,
        rollKind: 'initiative',
        ability: 'dexterity',
        characterName: combatant.name,
        ...(row.characterId ? { characterId: row.characterId } : {}),
      },
    }),
  );
}

/**
 * The situational modifiers a request carries, read before anything is
 * rolled or spent: a typo refuses the whole request.
 */
function parseBonus(value: unknown): { roll?: ParsedBonus; damage?: ParsedBonus } {
  const read = readRollBonus(value);
  if ('error' in read) refuse(422, read.error);
  return read;
}

/** A d20 test with the situational modifier, within the dice limits of one roll. */
function rollTestWith(modifier: number, mode: RollMode, extra: ParsedBonus | undefined) {
  if (extra && !bonusFits({ dice: 1, modifier }, extra)) refuse(422, BONUS_TOO_BIG);
  return rollTest(modifier, mode, extra);
}

function parseMode(value: unknown): RollMode {
  if (value === undefined) return 'normal';
  if (!isRollMode(value)) refuse(422, 'Modo de rolagem inválido.');
  return value;
}

function parseInitiativeValue(value: unknown): number {
  const parsed = boundedInteger(value, E.initiative.min, E.initiative.max);
  if (parsed === undefined) refuse(422, `A iniciativa deve ser um número entre ${E.initiative.min} e ${E.initiative.max}.`);
  return parsed;
}

function parseHidden(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') refuse(422, 'Valor inválido para "escondido".');
  return value;
}

/**
 * Copies of a bestiary entry joining the encounter, numbered among those
 * already in it. Each copy keeps the entry's values: editing it later never
 * changes the fight. Returns the new combatants' ids.
 */
function insertCopies(mutation: Mutation, statblockId: string, count: number, hpMode: unknown, hidden: boolean): string[] {
  const { tx, loaded } = mutation;
  const statblock = tx
    .select()
    .from(statblocks)
    .where(and(eq(statblocks.id, statblockId), eq(statblocks.campaignId, loaded.encounter.campaignId)))
    .get();
  if (!statblock) refuse(404, 'Criatura não encontrada.');
  if (loaded.combatants.length + count > E.combatants) refuse(422, `Limite de ${E.combatants} combatentes por encontro.`);
  const hp = hpMode ?? 'average';
  if (hp !== 'average' && hp !== 'rolled') refuse(422, 'Escolha PV médio ou rolado.');
  if (hp === 'rolled' && !statblock.hpFormula) refuse(422, `${statblock.name} não tem fórmula de PV para rolar.`);

  // Numbered after every name, hidden ones too: a combatant keeps its name for good (#156).
  const names = numberCopies(statblock.name, count, loaded.combatants.map(({ name }) => name));
  return names.map((name) => {
    // A roll can land below 1 with a negative modifier; a creature starts standing.
    const hpMax = hp === 'rolled' ? Math.max(1, rollDice(statblock.hpFormula)!.total) : statblock.hpAverage;
    const id = randomUUID();
    tx.insert(combatants)
      .values({
        id,
        encounterId: loaded.encounter.id,
        source: 'statblock',
        statblockId: statblock.id,
        name,
        size: statblock.size,
        ac: statblock.ac,
        hpMax,
        hpCurrent: hpMax,
        hpTemp: 0,
        conditions: [],
        concentrating: false,
        dexModifier: abilityModifier(statblock.abilityScores.dexterity) ?? 0,
        initiativeBonus: statblock.initiativeBonus,
        constitutionModifier: abilityModifier(statblock.abilityScores.constitution) ?? 0,
        saveModifiers: saveModifiers(statblock.abilityScores, statblock.saveBonuses),
        attacks: statblock.attacks.map(storedAttack),
        speed: speedFromText(statblock.speed) ?? TURN_LIMITS.defaultSpeed,
        attacksPerAction: statblock.attacksPerAction,
        hidden,
      })
      .run();
    return id;
  });
}

/**
 * A free token copied from the bestiary joins the fight: a copy of its entry
 * becomes a combatant (hidden if the token is) and the token stands for it
 * from then on, where it is. The hit points have one home, the combatant.
 */
function joinToken(mutation: Mutation, body: Record<string, unknown>) {
  const { tx, loaded } = mutation;
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
  const token = tx
    .select({ id: tokens.id, kind: tokens.kind, statblockId: tokens.statblockId, hidden: tokens.hidden, sceneId: tokens.sceneId })
    .from(tokens)
    .innerJoin(scenes, eq(scenes.id, tokens.sceneId))
    .where(and(eq(tokens.id, tokenId), eq(scenes.campaignId, loaded.encounter.campaignId)))
    .get();
  if (!token) refuse(404, 'Token não encontrado.');
  if (token.kind !== 'free') refuse(409, 'Este token já está ligado a um personagem ou combatente.');
  if (!token.statblockId) refuse(422, 'Só um token do bestiário entra no combate assim; adicione os outros pela fila.');
  const [combatantId] = insertCopies(mutation, token.statblockId, 1, body.hp, token.hidden);
  // The combatant's name and size are the token's from now on.
  tx.update(tokens).set({ kind: 'combatant', combatantId, label: null, size: null }).where(eq(tokens.id, token.id)).run();
  mutation.scenes.add(token.sceneId);
}

function addCombatants(mutation: Mutation, body: Record<string, unknown>) {
  const { tx, loaded } = mutation;
  const encounterId = loaded.encounter.id;
  const campaignId = loaded.encounter.campaignId;
  const hidden = parseHidden(body.hidden);
  const existing = loaded.combatants.length;

  if (body.source === 'character') {
    const characterId = typeof body.characterId === 'string' ? body.characterId : '';
    const sheet = tx
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.campaignId, campaignId)))
      .get();
    if (!sheet) refuse(404, 'Personagem não encontrado.');
    if (loaded.combatants.some((combatant) => combatant.row.characterId === sheet.id)) {
      refuse(409, `${sheet.name} já está neste encontro.`);
    }
    if (existing + 1 > E.combatants) refuse(422, `Limite de ${E.combatants} combatentes por encontro.`);
    tx.insert(combatants)
      .values({
        id: randomUUID(),
        encounterId,
        source: 'character',
        characterId: sheet.id,
        name: sheet.name,
        size: sheet.size,
        dexModifier: abilityModifier(sheet.abilityScores.dexterity) ?? 0,
        hidden,
      })
      .run();
    return;
  }

  if (body.source === 'statblock') {
    const statblockId = typeof body.statblockId === 'string' ? body.statblockId : '';
    const count = boundedInteger(body.count ?? 1, 1, E.copies);
    if (count === undefined) refuse(422, `A quantidade deve ser um número entre 1 e ${E.copies}.`);
    insertCopies(mutation, statblockId, count, body.hp, hidden);
    return;
  }

  if (body.source === 'token') {
    joinToken(mutation, body);
    return;
  }

  if (body.source === 'manual') {
    const name = shortText(body.name, S.name);
    if (!name) refuse(422, `Informe o nome do combatente, com até ${S.name} caracteres.`);
    const size = body.size ?? 'medium';
    if (!isSize(size)) refuse(422, 'Tamanho inválido.');
    const ac = boundedInteger(body.ac, S.ac.min, S.ac.max);
    if (ac === undefined) refuse(422, `CA deve ser um número entre ${S.ac.min} e ${S.ac.max}.`);
    const hpMax = boundedInteger(body.hp, S.hp.min, S.hp.max);
    if (hpMax === undefined) refuse(422, `PV deve ser um número entre ${S.hp.min} e ${S.hp.max}.`);
    const initiativeBonus = boundedInteger(body.initiativeBonus ?? 0, S.initiativeBonus.min, S.initiativeBonus.max);
    if (initiativeBonus === undefined) {
      refuse(422, `O bônus de iniciativa deve ser um número entre ${S.initiativeBonus.min} e ${S.initiativeBonus.max}.`);
    }
    const initiative = body.initiative === undefined || body.initiative === null ? null : parseInitiativeValue(body.initiative);
    if (existing + 1 > E.combatants) refuse(422, `Limite de ${E.combatants} combatentes por encontro.`);
    tx.insert(combatants)
      .values({
        id: randomUUID(),
        encounterId,
        source: 'manual',
        name,
        size,
        ac,
        hpMax,
        hpCurrent: hpMax,
        hpTemp: 0,
        conditions: [],
        concentrating: false,
        initiativeBonus,
        initiative,
        hidden,
      })
      .run();
    return;
  }

  refuse(422, 'Origem do combatente inválida: personagem, criatura do bestiário ou manual.');
}

function editCombatant(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  const { row } = combatant;
  const changes: Partial<typeof combatants.$inferInsert> = {};
  if (body.hidden !== undefined) changes.hidden = parseHidden(body.hidden);

  const sheetFields = ['name', 'ac', 'hpMax', 'speed', 'attacksPerAction'].filter((key) => body[key] !== undefined);
  if (sheetFields.length > 0 && row.source === 'character') {
    refuse(422, 'Nome, CA, PV, deslocamento e ataques de um personagem são alterados na ficha.');
  }
  if (body.speed !== undefined) {
    if (!isSpeed(body.speed)) refuse(422, `Deslocamento deve estar entre ${TURN_LIMITS.speed.min} e ${TURN_LIMITS.speed.max} metros.`);
    changes.speed = body.speed;
  }
  if (body.attacksPerAction !== undefined) {
    if (!isAttacksPerAction(body.attacksPerAction)) {
      refuse(422, `Ataques por ação deve ser um número entre ${TURN_LIMITS.attacksPerAction.min} e ${TURN_LIMITS.attacksPerAction.max}.`);
    }
    changes.attacksPerAction = body.attacksPerAction;
  }
  if (body.name !== undefined) {
    const name = shortText(body.name, S.name);
    if (!name) refuse(422, `Informe o nome do combatente, com até ${S.name} caracteres.`);
    changes.name = name;
  }
  if (body.ac !== undefined) {
    const ac = boundedInteger(body.ac, S.ac.min, S.ac.max);
    if (ac === undefined) refuse(422, `CA deve ser um número entre ${S.ac.min} e ${S.ac.max}.`);
    changes.ac = ac;
  }
  if (body.hpMax !== undefined) {
    const hpMax = boundedInteger(body.hpMax, S.hp.min, S.hp.max);
    if (hpMax === undefined) refuse(422, `PV deve ser um número entre ${S.hp.min} e ${S.hp.max}.`);
    changes.hpMax = hpMax;
    // In preparation the creature starts full; mid-fight its damage stays.
    // Its effects (Aid) still count on top of the new maximum.
    const effective = effectiveHpMax(hpMax, row.effects);
    changes.hpCurrent =
      mutation.loaded.encounter.status === 'preparing' ? effective : Math.min(row.hpCurrent ?? effective, effective);
  }
  if (Object.keys(changes).length === 0) refuse(422, 'Nada para alterar.');
  mutation.tx.update(combatants).set(changes).where(eq(combatants.id, row.id)).run();
}

/**
 * Passes the turn on when the active combatant is about to leave. Runs before
 * the combatant goes, so its position in the queue is still known.
 */
function handOffTurn(tx: Executor, loaded: LoadedEncounter, combatantId: string, touched = new Set<string>()) {
  const { encounter } = loaded;
  if (encounter.activeCombatantId !== combatantId) return;
  const next = nextTurn(turnOrder(loaded), encounter.activeCombatantId, encounter.round);
  const activeId = next.activeId === combatantId ? null : next.activeId;
  tx.update(encounters).set({ activeCombatantId: activeId, round: next.round }).where(eq(encounters.id, encounter.id)).run();
  beginTurn(tx, activeId);
  const taking = loaded.combatants.find((combatant) => combatant.row.id === activeId);
  if (taking) startEffectsOf(tx, taking, touched);
}

/** The bearer's turn begins: what lasted until then (Shield) ends. */
function startEffectsOf(tx: Executor, combatant: LoadedCombatant, touched: Set<string>) {
  const { remaining, expired } = startTurnEffects(combatant.effects);
  if (expired.length > 0) writeEffects(tx, combatant, remaining, touched);
}

/**
 * The scenes an encounter shows on, read before a change: removing a
 * combatant takes its token with it, and a character's token is the sheet's,
 * whose reach follows the turn too.
 */
function scenesOfEncounter(tx: Executor, loaded: LoadedEncounter): string[] {
  return [
    ...new Set([
      ...scenesShowing(tx, { combatantIds: loaded.combatants.map((combatant) => combatant.row.id) }),
      ...loaded.combatants.flatMap((combatant) =>
        combatant.row.characterId ? scenesShowing(tx, { characterId: combatant.row.characterId }) : []),
    ]),
  ];
}

type Waiting = { id: string; characterId: string | null };

/** The turn moved (round 1 opening included): whoever does not hold it now waits. */
function turnWaiters(before: LoadedEncounter, after: LoadedEncounter): Waiting[] {
  const moved = after.encounter.activeCombatantId !== before.encounter.activeCombatantId || after.encounter.round !== before.encounter.round;
  if (!moved || after.encounter.status !== 'active') return [];
  return after.combatants
    .filter((combatant) => combatant.row.id !== after.encounter.activeCombatantId)
    .map((combatant) => ({ id: combatant.row.id, characterId: combatant.row.characterId }));
}

/** A creature that left the fight with its token: what to tell the table. */
export type TokenLeave = { loaded: LoadedEncounter; scenes: string[]; waiting: Waiting[] };

/**
 * The master deleted a combatant's token: the creature leaves the fight with
 * it, as if removed from the encounter, with the same effects on the other
 * maps (#156). Not from an ended encounter, which is history, nor while
 * another scene still has a token for it. Runs before the token goes; the
 * token's own scene is left to the caller, which saves and publishes it.
 */
export function leaveWithToken(tx: Executor, campaignId: string, token: { id: string; sceneId: string }, combatantId: string): TokenLeave | null {
  const others = tx
    .select({ id: tokens.id })
    .from(tokens)
    .where(and(eq(tokens.combatantId, combatantId), ne(tokens.id, token.id)))
    .get();
  if (others) return null;
  const row = tx.select({ encounterId: combatants.encounterId }).from(combatants).where(eq(combatants.id, combatantId)).get();
  const encounter = row && findEncounter(tx, campaignId, row.encounterId);
  if (!encounter || encounter.status === 'ended') return null;
  const before = loadEncounter(tx, encounter);
  const scenes = scenesOfEncounter(tx, before).filter((id) => id !== token.sceneId);
  handOffTurn(tx, before, combatantId);
  tx.update(encounters).set({ version: sql`${encounters.version} + 1` }).where(eq(encounters.id, encounter.id)).run();
  const leaving = loadEncounter(tx, encounter).combatants.find((combatant) => combatant.row.id === combatantId);
  if (leaving) clearEffects(tx, leaving, new Set());
  tx.delete(combatants).where(eq(combatants.id, combatantId)).run();
  // What its concentration held up on the others ends with it.
  settleEffects(tx, encounter, new Set());
  bumpScenes(tx, scenes);
  const after = loadEncounter(tx, findEncounter(tx, campaignId, encounter.id)!);
  return { loaded: after, scenes, waiting: turnWaiters(before, after) };
}

/** After the commit, in the order `mutate` uses: drags released, then the fight and the maps. */
export function publishTokenLeave(deps: Deps, campaignId: string, leave: TokenLeave) {
  for (const combatant of leave.waiting) releaseTurnDrags(deps, combatant);
  deps.hub.publishCombat(campaignId, (viewer) => projectEncounter(leave.loaded, viewer));
  publishScenes(deps, campaignId, leave.scenes);
}

function removeCombatant(mutation: Mutation, combatant: LoadedCombatant) {
  // Aid ends with the fight: a character leaves with the sheet's maximum.
  clearEffects(mutation.tx, combatant, mutation.characters);
  handOffTurn(mutation.tx, mutation.loaded, combatant.row.id, mutation.characters);
  mutation.tx.delete(combatants).where(eq(combatants.id, combatant.row.id)).run();
}

function setInitiative(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  const { viewer } = mutation;
  const master = viewer.role === 'master';
  if (!master) {
    if (combatant.ownerId !== viewer.userId) refuse(403, 'Você só rola a iniciativa do seu personagem.');
    if (body.value !== undefined) refuse(403, 'Só o mestre atribui um valor de iniciativa.');
    if (combatant.row.initiative !== null) refuse(409, 'Sua iniciativa já foi rolada neste combate.');
  }
  const mode = parseMode(body.mode);
  // Only on a rolled d20: a typed value is final.
  const extra = parseBonus(body.bonus).roll;

  if (body.value !== undefined) {
    mutation.tx
      .update(combatants)
      .set({ initiative: parseInitiativeValue(body.value) })
      .where(eq(combatants.id, combatant.row.id))
      .run();
    return;
  }
  if (body.secret !== undefined && typeof body.secret !== 'boolean') refuse(422, 'Valor inválido para "secreta".');
  // The master's rolls for monsters are secret unless told otherwise; a
  // character's roll is the table's business.
  const secret = master ? ((body.secret as boolean | undefined) ?? combatant.row.source !== 'character') : false;
  rollInitiative(mutation, combatant, { mode, secret, extra });
}

function changeTurn(mutation: Mutation, body: Record<string, unknown>) {
  const { loaded, viewer } = mutation;
  const { encounter } = loaded;
  if (encounter.status !== 'active') refuse(409, 'O combate não está em andamento.');
  const direction = body.direction;
  if (direction !== 'next' && direction !== 'previous') refuse(422, 'Direção inválida: próximo ou anterior.');

  // Going back and opening round 1 are the master's alone, whatever the turn.
  if (direction === 'previous' || encounter.round === 0) requireMaster(viewer);

  // A player sees `null` while a hidden combatant acts; that is still a match.
  // The round tells two turns of the same combatant apart: with one combatant
  // standing, the id alone would let a repeated request pass again.
  const expected = body.expectedActiveCombatantId ?? null;
  const active = loaded.combatants.find((combatant) => combatant.row.id === encounter.activeCombatantId);
  const seen = viewer.role !== 'master' && active?.row.hidden ? null : encounter.activeCombatantId;
  if (expected !== seen || body.expectedRound !== encounter.round) {
    refuse(409, 'O turno mudou enquanto você decidia. Confira a vez atual.', true);
  }

  if (direction === 'previous') {
    if (encounter.round === 0) refuse(409, 'A primeira rodada ainda não começou.');
    const order = turnOrder(loaded);
    // An empty step would still bump the version and reach the whole table.
    if (!hasPreviousTurn(order, encounter.activeCombatantId, encounter.round)) refuse(409, 'Ainda não há turno anterior.');
    const previous = previousTurn(order, encounter.activeCombatantId, encounter.round);
    setEncounter(mutation, { activeCombatantId: previous.activeId, round: previous.round });
    return;
  }

  if (encounter.round === 0) {
    const missing = loaded.combatants.filter((combatant) => combatant.row.initiative === null);
    if (missing.length > 0) {
      refuse(409, `Falta iniciativa: ${missing.map((combatant) => combatant.name).join(', ')}.`);
    }
    const first = nextTurn(turnOrder(loaded), null, 1);
    if (!first.activeId) refuse(409, 'Não há combatentes de pé para começar.');
    setEncounter(mutation, { activeCombatantId: first.activeId, round: 1 });
    return;
  }

  if (viewer.role !== 'master' && active?.ownerId !== viewer.userId) {
    refuse(403, 'Só o mestre passa a vez de outro combatente.');
  }
  // Durations run out at the end of the affected combatant's own turn.
  if (active) {
    const { remaining, expired } = tickConditions(active.conditions);
    for (const condition of expired) tell(mutation, active, { kind: 'combat.condition', ...about(mutation, active), action: 'expired', condition });
    if (active.row.characterId) {
      mutation.tx.update(characters).set({ conditions: remaining }).where(eq(characters.id, active.row.characterId)).run();
      mutation.characters.add(active.row.characterId);
    } else {
      mutation.tx.update(combatants).set({ conditions: remaining }).where(eq(combatants.id, active.row.id)).run();
    }
    // Durations in rounds count down even when none runs out.
    if (active.effects.some((effect) => effect.duration === 'rounds')) {
      writeEffects(mutation.tx, active, tickEffects(active.effects).remaining, mutation.characters);
    }
  }
  const next = nextTurn(turnOrder(loaded), encounter.activeCombatantId, encounter.round);
  setEncounter(mutation, { activeCombatantId: next.activeId, round: next.round });
  // Read again: the one taking the turn may be the one whose turn just ended.
  const taking = loadEncounter(mutation.tx, encounter).combatants.find((combatant) => combatant.row.id === next.activeId);
  if (taking) startEffectsOf(mutation.tx, taking, mutation.characters);
}

function startEncounter(mutation: Mutation) {
  const { tx, loaded } = mutation;
  const { encounter } = loaded;
  requireMaster(mutation.viewer);
  if (encounter.status !== 'preparing') refuse(409, 'Este combate já começou.');
  const running = tx
    .select({ id: encounters.id })
    .from(encounters)
    .where(and(eq(encounters.campaignId, encounter.campaignId), eq(encounters.status, 'active')))
    .get();
  if (running) refuse(409, 'Já há um combate em andamento nesta campanha. Encerre-o antes de começar outro.');
  setEncounter(mutation, { status: 'active', round: 0, activeCombatantId: null, startedAt: new Date() });
  mutation.events.push(
    recordCombatEvent(tx, {
      campaignId: encounter.campaignId,
      userId: mutation.viewer.userId,
      userName: mutation.userName,
      payload: { kind: 'combat.started', encounterId: encounter.id, encounterName: encounter.name },
    }),
  );
}

function endEncounter(mutation: Mutation) {
  const { tx, loaded } = mutation;
  const { encounter } = loaded;
  requireMaster(mutation.viewer);
  if (encounter.status !== 'active') refuse(409, 'Este combate não está em andamento.');
  setEncounter(mutation, { status: 'ended', activeCombatantId: null, endedAt: new Date() });
  // Effects live in the fight: they all end with it, and Aid's hit points go.
  for (const combatant of loaded.combatants) clearEffects(tx, combatant, mutation.characters);
  // A condition stays on the sheet after the fight, but its duration in
  // rounds means nothing outside of it.
  for (const combatant of loaded.combatants) {
    if (!combatant.row.characterId || !combatant.conditions.some((active) => active.roundsLeft !== undefined)) continue;
    const conditions = combatant.conditions.map(({ roundsLeft: _roundsLeft, ...active }) => active);
    tx.update(characters).set({ conditions }).where(eq(characters.id, combatant.row.characterId)).run();
    mutation.characters.add(combatant.row.characterId);
  }
  mutation.events.push(
    recordCombatEvent(tx, {
      campaignId: encounter.campaignId,
      userId: mutation.viewer.userId,
      userName: mutation.userName,
      payload: {
        kind: 'combat.ended',
        encounterId: encounter.id,
        encounterName: encounter.name,
        rounds: encounter.round,
        defeated: queueOrder(loaded)
          .filter((combatant) => combatant.row.source !== 'character' && combatant.hpCurrent <= 0)
          .map((combatant) => ({ name: combatant.name, hidden: combatant.row.hidden })),
      },
    }),
  );
}

function setTieOrder(mutation: Mutation, body: Record<string, unknown>) {
  const ids = body.combatantIds;
  const known = new Set(mutation.loaded.combatants.map((combatant) => combatant.row.id));
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => typeof id === 'string' && known.has(id))
  ) {
    refuse(422, 'Informe os combatentes empatados na ordem desejada.');
  }
  ids.forEach((id: string, index) => {
    mutation.tx.update(combatants).set({ tieOrder: index }).where(eq(combatants.id, id)).run();
  });
}

// --- Hit points, conditions, concentration and death saves ------------------------

function requireActive(encounter: EncounterRow) {
  if (encounter.status !== 'active') refuse(409, 'O combate não está em andamento.');
}

function requireOwnOrMaster(mutation: Mutation, combatant: LoadedCombatant) {
  if (mutation.viewer.role !== 'master' && combatant.ownerId !== mutation.viewer.userId) {
    refuse(403, 'Você só altera o seu próprio personagem.');
  }
}

type Vitals = Partial<{
  hpCurrent: number;
  hpTemp: number;
  conditions: ActiveCondition[];
  concentrating: boolean;
  /** Only a character has them. */
  deathSaves: DeathSaves;
}>;

/**
 * Writes each value where it lives: a character's on the sheet, everyone
 * else's on the combatant. Reminders always stay on the combatant, and only
 * the ones still meaningful after the change are kept.
 */
function writeVitals(mutation: Mutation, combatant: LoadedCombatant, vitals: Vitals, reminders = combatant.row.reminders) {
  const { tx } = mutation;
  const { row } = combatant;
  if (row.characterId) {
    if (Object.keys(vitals).length > 0) {
      tx.update(characters).set({ ...vitals, updatedAt: new Date() }).where(eq(characters.id, row.characterId)).run();
      mutation.characters.add(row.characterId);
      // The same character in another encounter: its reminders follow the sheet too.
      settleCharacterReminders(tx, row.characterId, row.id);
    }
  } else {
    const { deathSaves: _deathSaves, ...own } = vitals;
    if (Object.keys(own).length > 0) tx.update(combatants).set(own).where(eq(combatants.id, row.id)).run();
  }
  const kept = pendingReminders(reminders, {
    hpCurrent: vitals.hpCurrent ?? combatant.hpCurrent,
    concentrating: vitals.concentrating ?? combatant.concentrating,
  });
  if (JSON.stringify(kept) !== JSON.stringify(row.reminders)) {
    tx.update(combatants).set({ reminders: kept }).where(eq(combatants.id, row.id)).run();
  }
}

function isHpOperation(value: unknown): value is HpOperation {
  return typeof value === 'string' && (HP_OPERATIONS as readonly string[]).includes(value);
}

function changeHitPoints(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  const { operation } = body;
  if (!isHpOperation(operation)) refuse(422, 'Operação inválida: dano, cura ou temporários.');
  const amount = boundedInteger(body.amount, C.hpAmount.min, C.hpAmount.max);
  if (amount === undefined) refuse(422, `A quantidade deve ser um número entre ${C.hpAmount.min} e ${C.hpAmount.max}.`);
  applyHitPoints(mutation, combatant, operation, amount);
}

/**
 * One change of hit points with everything it sets off: the reminders a hit
 * leaves, the death saves a recovery resets, and the feed. `reminders` is the
 * list to start from, so a pending damage can be consumed in the same write.
 */
function applyHitPoints(
  mutation: Mutation,
  combatant: LoadedCombatant,
  operation: HpOperation,
  amount: number,
  reminders = combatant.row.reminders,
) {
  const before = { hpCurrent: combatant.hpCurrent, hpTemp: combatant.hpTemp };
  const { hitPoints, fell, rose } = applyHpChange(before, operation, amount, combatant.hpMax);
  // Damage always counts, even at 0: it is a death save failure to record.
  if (operation !== 'damage' && hitPoints.hpCurrent === before.hpCurrent && hitPoints.hpTemp === before.hpTemp) {
    refuse(409, operation === 'heal' ? `${combatant.name} já está com os PV cheios.` : `${combatant.name} já tem PV temporários iguais ou maiores.`);
  }

  const vitals: Vitals = { ...hitPoints };
  // Back on their feet, a character starts the death saves over.
  if (rose && combatant.sheet) vitals.deathSaves = { successes: 0, failures: 0 };
  // The fall ends the concentration: no save to keep it, and its pending ones go.
  const concentrating = keepsConcentration(combatant.concentrating, hitPoints.hpCurrent);
  if (concentrating !== combatant.concentrating) vitals.concentrating = concentrating;
  const drafts =
    operation === 'damage'
      ? damageReminders({ amount, hpCurrentBefore: before.hpCurrent, concentrating, source: combatant.row.source })
      : [];
  const created = drafts.map((draft) => ({ id: randomUUID(), ...draft }) as CombatReminder);
  writeVitals(mutation, combatant, vitals, [...reminders, ...created]);

  // Temporary hit points stay out of the feed. The hit that takes a monster
  // down is told once, as its defeat.
  if (operation === 'temp') return;
  const kind = operation === 'heal' ? 'combat.heal' : fell && combatant.row.source !== 'character' ? 'combat.defeated' : 'combat.damage';
  tell(mutation, combatant, {
    kind,
    ...about(mutation, combatant),
    // What was healed, not what was asked: healing stops at the maximum.
    amount: operation === 'heal' ? hitPoints.hpCurrent - before.hpCurrent : amount,
    hpCurrent: hitPoints.hpCurrent,
    hpMax: combatant.hpMax,
    band: healthBand(hitPoints.hpCurrent, combatant.hpMax),
    ...(fell && combatant.row.source === 'character' ? { fell: true as const } : {}),
  });
}

/** Who an event is about, as the feed stores it. */
function about(mutation: Mutation, combatant: LoadedCombatant) {
  return { encounterId: mutation.loaded.encounter.id, combatantId: combatant.row.id, name: combatant.name, source: combatant.row.source };
}

/** Writes a fight event; a hidden combatant's stays the master's, even once revealed. */
function tell(mutation: Mutation, combatant: LoadedCombatant, payload: CombatPayload) {
  mutation.events.push(
    recordCombatEvent(mutation.tx, {
      campaignId: mutation.loaded.encounter.campaignId,
      userId: mutation.viewer.userId,
      userName: mutation.userName,
      secret: combatant.row.hidden,
      payload,
    }),
  );
}

function parseCondition(param: string | undefined, body: Record<string, unknown>): ActiveCondition {
  if (!isCondition(param)) refuse(422, 'Condição desconhecida.');
  const active: ActiveCondition = { condition: param };
  if (param === 'exhaustion') {
    const level = boundedInteger(body.level, 1, EXHAUSTION_MAX);
    if (level === undefined) refuse(422, `Informe o nível de exaustão, de 1 a ${EXHAUSTION_MAX}.`);
    active.level = level;
  } else if (body.level !== undefined) {
    refuse(422, 'Só a exaustão tem nível.');
  }
  if (body.roundsLeft !== undefined && body.roundsLeft !== null) {
    const roundsLeft = boundedInteger(body.roundsLeft, C.conditionRounds.min, C.conditionRounds.max);
    if (roundsLeft === undefined) refuse(422, `A duração vai de ${C.conditionRounds.min} a ${C.conditionRounds.max} rodadas.`);
    active.roundsLeft = roundsLeft;
  }
  return active;
}

function applyCondition(mutation: Mutation, combatant: LoadedCombatant, active: ActiveCondition) {
  const conditions = setCondition(combatant.conditions, active);
  if (JSON.stringify(conditions) === JSON.stringify(combatant.conditions)) refuse(409, 'Essa condição já está assim.');
  writeVitals(mutation, combatant, { conditions });
  tell(mutation, combatant, { kind: 'combat.condition', ...about(mutation, combatant), action: 'applied', condition: active });
}

function dropCondition(mutation: Mutation, combatant: LoadedCombatant, param: string | undefined) {
  if (!isCondition(param)) refuse(422, 'Condição desconhecida.');
  const removed = combatant.conditions.find(({ condition }) => condition === param);
  if (!removed) refuse(409, `${combatant.name} não está com essa condição.`);
  writeVitals(mutation, combatant, { conditions: removeCondition(combatant.conditions, param) });
  tell(mutation, combatant, { kind: 'combat.condition', ...about(mutation, combatant), action: 'removed', condition: removed });
}

function setConcentration(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  if (typeof body.concentrating !== 'boolean') refuse(422, 'Valor inválido para "concentrando".');
  if (body.concentrating === combatant.concentrating) {
    refuse(409, body.concentrating ? `${combatant.name} já está concentrando.` : `${combatant.name} não está concentrando.`);
  }
  if (body.concentrating && !keepsConcentration(true, combatant.hpCurrent)) {
    refuse(409, `${combatant.name} está caído e não consegue se concentrar.`);
  }
  writeVitals(mutation, combatant, { concentrating: body.concentrating });
}

/** A reminder still pending on this combatant; one that lost its meaning no longer exists. */
function findReminder(combatant: LoadedCombatant, id: unknown, kind?: CombatReminder['kind']): CombatReminder {
  const reminder = pendingReminders(combatant.row.reminders, combatant).find(
    (candidate) => candidate.id === id && (!kind || candidate.kind === kind),
  );
  if (!reminder) refuse(404, 'Lembrete não encontrado.');
  return reminder;
}

function withoutReminder(combatant: LoadedCombatant, reminder: CombatReminder): CombatReminder[] {
  return combatant.row.reminders.filter((candidate) => candidate.id !== reminder.id);
}

/**
 * Rolls a death save on the server, or records failures from damage taken at
 * 0 hit points. A player rolls on their own turn, once per round; the master
 * may roll again to correct a mistake.
 */
function deathSave(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  const { row, sheet, name } = combatant;
  if (!sheet) refuse(422, 'Só personagens fazem teste contra a morte.');
  if (combatant.hpCurrent > 0) refuse(409, `${name} não está caído.`);
  const status = deathSaveStatus(sheet.deathSaves);
  if (status === 'dead') refuse(409, `${name} já falhou em três testes contra a morte.`);

  if (body.failures !== undefined) {
    if (body.mode !== undefined) refuse(422, 'Vantagem e desvantagem valem só para a rolagem.');
    if (body.failures !== 1 && body.failures !== 2) refuse(422, 'Registre uma ou duas falhas.');
    const reminders =
      body.reminderId === undefined ? row.reminders : withoutReminder(combatant, findReminder(combatant, body.reminderId, 'deathFailure'));
    const saves = deathSaveFailure(sheet.deathSaves, body.failures);
    writeVitals(mutation, combatant, { deathSaves: saves }, reminders);
    tell(mutation, combatant, { kind: 'combat.deathSave', ...about(mutation, combatant), failures: body.failures, saves, outcome: deathSaveStatus(saves) });
    return;
  }

  if (status === 'stable') refuse(409, `${name} está estável e não rola mais testes contra a morte.`);
  const mode = parseMode(body.mode);
  const { encounter } = mutation.loaded;
  if (mutation.viewer.role !== 'master') {
    if (encounter.activeCombatantId !== row.id) refuse(409, 'Role o teste contra a morte na sua vez.');
    if (row.deathSaveRound === encounter.round) refuse(409, 'Você já rolou o teste contra a morte nesta rodada.');
  }
  // Under advantage or disadvantage, the kept die decides, a natural 20 or 1 included:
  // with no modifier, the total of a single d20 is that die.
  const roll = rollDice('1d20', mode)!;
  const d20 = roll.total;
  const outcome = deathSaveOutcome(d20, sheet.deathSaves);
  const vitals: Vitals = { deathSaves: outcome.saves };
  if (outcome.hpCurrent !== undefined) vitals.hpCurrent = outcome.hpCurrent;
  writeVitals(mutation, combatant, vitals);
  mutation.tx.update(combatants).set({ deathSaveRound: encounter.round }).where(eq(combatants.id, row.id)).run();
  tell(mutation, combatant, {
    kind: 'combat.deathSave',
    ...about(mutation, combatant),
    d20,
    ...(mode === 'normal' ? {} : { mode, rolls: [roll.dice[0]!.value, roll.dice[1]!.value] as [number, number] }),
    saves: outcome.saves,
    outcome: outcome.status,
  });
}

/**
 * The Constitution save a concentration reminder asks for. It answers the
 * reminder; keeping or ending the concentration is the table's call.
 */
function concentrationSave(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  if (typeof body.reminderId !== 'string') refuse(422, 'Informe o lembrete da salvaguarda.');
  const reminder = findReminder(combatant, body.reminderId, 'concentration');
  if (reminder.kind !== 'concentration') refuse(404, 'Lembrete não encontrado.');
  const mode = parseMode(body.mode);
  const extra = parseBonus(body.bonus).roll;
  if (body.secret !== undefined && typeof body.secret !== 'boolean') refuse(422, 'Valor inválido para "secreta".');
  const { row } = combatant;
  // A monster's roll is the master's unless told otherwise; a character's is the table's.
  const secret = mutation.viewer.role === 'master' ? ((body.secret as boolean | undefined) ?? row.source !== 'character') : false;
  const bonus = saveModifierOf(combatant, 'constitution');
  const result = rollTestWith(bonus, mode, extra);
  mutation.events.push(
    recordRollEvent(mutation.tx, {
      campaignId: mutation.loaded.encounter.campaignId,
      userId: mutation.viewer.userId,
      userName: mutation.userName,
      secret: secret || row.hidden,
      payload: {
        kind: 'roll',
        ...result,
        rollKind: 'save',
        ability: 'constitution',
        characterName: combatant.name,
        concentrationDc: reminder.dc,
        ...(row.characterId ? { characterId: row.characterId } : {}),
      },
    }),
  );
  writeVitals(mutation, combatant, {}, withoutReminder(combatant, reminder));
}

function sourceOf(combatant: LoadedCombatant): 'character' | 'monster' {
  return combatant.row.source === 'character' ? 'character' : 'monster';
}

/**
 * What using a row costs its user: on its own turn, the row's cost (an
 * attack of an Attack action, the action, the bonus action or the reaction);
 * out of turn it is an opportunity attack, the reaction. A target's save is
 * free. Before round 1 nobody's turn has begun, and nothing is counted.
 */
function attackCost(tx: Executor, encounter: EncounterRow, combatant: LoadedCombatant, cost: AttackCost): string | null {
  if (encounter.round === 0) return null;
  const spend = attackSpend(cost, encounter.activeCombatantId === combatant.row.id);
  const result = spendTurn(budgetOf(combatant.row), spend, combatant.attacksPerAction);
  if (!result.ok) return result.error;
  writeBudget(tx, combatant.row.id, result.budget);
  return null;
}

function spendOnAttack(mutation: Mutation, combatant: LoadedCombatant, cost: AttackCost) {
  const refused = attackCost(mutation.tx, mutation.loaded.encounter, combatant, cost);
  if (refused) refuse(422, refused);
}

/**
 * An attack rolled from the sheet of a character fighting in the campaign's
 * running encounter costs the same as one rolled from the combat. Returns
 * why it is refused, or null; the caller publishes the encounter it changed.
 */
export function spendSheetAttack(tx: Executor, campaignId: string, characterId: string, cost: AttackCost): string | null {
  const running = tx
    .select({ id: encounters.id })
    .from(encounters)
    .innerJoin(combatants, eq(combatants.encounterId, encounters.id))
    .where(and(eq(encounters.campaignId, campaignId), eq(encounters.status, 'active'), eq(combatants.characterId, characterId)))
    .get();
  if (!running) return null;
  const loaded = loadEncounter(tx, findEncounter(tx, campaignId, running.id)!);
  const combatant = loaded.combatants.find((candidate) => candidate.row.characterId === characterId);
  return combatant ? attackCost(tx, loaded.encounter, combatant, cost) : null;
}

const ECONOMY = ['action', 'bonusAction', 'reaction', 'dash'] as const;
type Economy = (typeof ECONOMY)[number];

function parseEconomy(value: unknown): Economy {
  if (!(ECONOMY as readonly unknown[]).includes(value)) refuse(422, 'Escolha ação, ação bônus, reação ou Disparada.');
  return value as Economy;
}

/**
 * The turn's economy outside the attack: spending an action, the bonus
 * action, the reaction or a Dash (the owner on their own turn, the reaction at
 * any time); giving one back and granting an extra action are the master's.
 */
function changeEconomy(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  const { encounter } = mutation.loaded;
  if (encounter.round === 0) refuse(409, 'A primeira rodada ainda não começou.');
  const budget = budgetOf(combatant.row);
  const master = mutation.viewer.role === 'master';

  if (body.grant !== undefined) {
    requireMaster(mutation.viewer);
    if (body.grant !== 'action') refuse(422, 'Só uma ação pode ser concedida.');
    writeBudget(mutation.tx, combatant.row.id, grantAction(budget));
    return;
  }
  if (body.refund !== undefined) {
    requireMaster(mutation.viewer);
    writeBudget(mutation.tx, combatant.row.id, refundTurn(budget, parseEconomy(body.refund)));
    return;
  }
  const spend = parseEconomy(body.spend);
  const ownTurn = encounter.activeCombatantId === combatant.row.id;
  if (!master && spend !== 'reaction' && !ownTurn) refuse(403, 'Fora do seu turno, só a reação pode ser usada.');
  const result = spendTurn(budget, spend, combatant.attacksPerAction);
  if (!result.ok) refuse(422, result.error);
  writeBudget(mutation.tx, combatant.row.id, result.budget);
}

/**
 * The targets of an attack, all checked before anything is spent or rolled:
 * an invalid one refuses the whole use. Older clients send `targetId`, read
 * as a list of one. Only a save row (an area: Bola de Fogo) takes more than
 * one; an attack roll has a single target.
 */
function parseTargets(mutation: Mutation, attacker: LoadedCombatant, chosen: Attack, body: Record<string, unknown>): LoadedCombatant[] {
  const raw = body.targetIds !== undefined
    ? body.targetIds
    : body.targetId === undefined || body.targetId === null ? [] : [body.targetId];
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) refuse(422, 'Alvo inválido.');
  const ids = raw as string[];
  if (ids.length > C.attackTargets) refuse(422, `Escolha até ${C.attackTargets} alvos.`);
  if (ids.length > 1 && chosen.kind !== 'save') refuse(422, 'Um ataque com rolagem de acerto tem um alvo só.');
  if (new Set(ids).size !== ids.length) refuse(422, 'Cada alvo entra uma vez só.');
  return ids.map((id) => {
    const target = findCombatant(mutation, id);
    if (target.row.id === attacker.row.id) refuse(422, 'Escolha outro combatente como alvo.');
    return target;
  });
}

/** Who a target is in the event. A hidden one is marked, so a player's copy leaves it out. */
function aimedAt(target: LoadedCombatant) {
  return {
    combatantId: target.row.id,
    name: target.name,
    source: sourceOf(target),
    ...(target.row.hidden ? { hidden: true as const } : {}),
  };
}

/** One target's save, rolled here so the table waits for no one. It costs the target nothing. */
function targetSave(target: LoadedCombatant, chosen: Extract<Attack, { kind: 'save' }>): SaveRoll {
  return rollSave(
    saveModifierOf(target, chosen.saveAbility),
    chosen.dc,
    failsSaveOutright(chosen.saveAbility, target.conditions, target.hpCurrent === 0),
    undefined,
    saveConditions(chosen.saveAbility, target.conditions),
  );
}

/**
 * An attack, rolled on the server. With a target, the attack roll is
 * compared with its AC and a hit rolls the damage, left pending on the
 * target for the master to apply. Without one, only the attack roll is made
 * and its damage can be rolled later, once. A save row may hit several
 * targets: its cost is paid once, its damage rolled once, and each target
 * rolls its own save and gets its own pending damage. Reactions happen out of
 * turn, so the turn is not checked.
 */
function attack(mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) {
  const { row } = combatant;
  if (isDefeated({ source: row.source, hpCurrent: combatant.hpCurrent }) || combatant.hpCurrent === 0) {
    refuse(409, `${combatant.name} está fora de combate.`);
  }
  const index = body.attackIndex;
  const chosen = typeof index === 'number' && Number.isInteger(index) ? attacksOf(combatant)[index] : undefined;
  if (!chosen) refuse(422, 'Ataque inválido.');
  const mode = parseMode(body.mode);
  // A save row has no roll of its own: only the damage's modifier counts there.
  const extra = parseBonus(body.bonus);
  if (chosen.kind === 'save' && mode !== 'normal') {
    refuse(422, 'Vantagem e desvantagem não se aplicam a um ataque por salvaguarda.');
  }
  if (body.secret !== undefined && typeof body.secret !== 'boolean') refuse(422, 'Valor inválido para "secreta".');
  const master = mutation.viewer.role === 'master';
  if (!master && body.secret === true) refuse(403, 'Apenas o mestre pode rolar em segredo.');
  const targets = parseTargets(mutation, combatant, chosen, body);
  if (chosen.kind === 'attack' && extra.roll && !bonusFits({ dice: 1, modifier: chosen.bonus }, extra.roll)) refuse(422, BONUS_TOO_BIG);
  // A damage that does not fit even without a critical is refused before anything is spent. Whether a
  // critical's doubled dice fit is known only once the d20 is rolled: refused then, the whole attack rolls back.
  if (extra.damage && hasDamage(chosen) && !rollDamage(chosen.damage, false, () => 0, extra.damage)) refuse(422, BONUS_TOO_BIG);
  spendOnAttack(mutation, combatant, chosen.cost);

  // A monster's attack is the master's unless told otherwise, like its
  // initiative; a character's is the table's. A hidden attacker would be
  // given away by the event. A hidden target of an attack roll too; among
  // the targets of a save, a hidden one only leaves the player's copy, and
  // an area of hidden ones only is secret, so the feed filters it in SQL.
  const secret =
    (master ? ((body.secret as boolean | undefined) ?? row.source !== 'character') : false) ||
    row.hidden ||
    (targets.length > 0 && targets.every((target) => target.row.hidden));

  const base = {
    kind: 'roll' as const,
    rollKind: 'attack' as const,
    attackName: chosen.name,
    // As the row reads now: editing the sheet later does not rewrite the feed.
    ...(chosen.range ? { attackRange: chosen.range } : {}),
    characterName: combatant.name,
    attackerSource: sourceOf(combatant),
    ...(row.characterId ? { characterId: row.characterId } : {}),
  };

  if (chosen.kind === 'save') {
    saveAttack(mutation, combatant, chosen, targets, secret, base, extra.damage);
    return;
  }

  const [target] = targets;
  const roll = rollAttackHit(chosen.bonus, mode, Math.random, extra.roll);
  const { critical, ...result } = roll;
  const payload: RollPayload = { ...base, ...result, critical };
  if (!target) {
    payload.damageRollable = { expression: chosen.damage, damageType: chosen.damageType };
  } else {
    const hit = isHit(roll, target.ac);
    payload.target = { ...aimedAt(target), hit, ac: target.ac };
    if (hit) {
      const damage = rollDamage(chosen.damage, critical, Math.random, extra.damage);
      if (!damage) refuse(422, extra.damage ? BONUS_TOO_BIG : 'O dano deste ataque passa do limite de dados no crítico ou é inválido.');
      payload.damage = { ...damage, damageType: chosen.damageType };
    }
  }

  const event = recordAttack(mutation, payload, secret);
  if (!target || !payload.damage || payload.damage.total === 0) return;
  const pending: CombatReminder = {
    id: randomUUID(),
    kind: 'pendingDamage',
    amount: payload.damage.total,
    damageType: chosen.damageType,
    critical: payload.critical === true,
    attackerName: combatant.name,
    attackName: chosen.name,
    eventId: event.id,
    secret,
  };
  writeVitals(mutation, target, {}, [...target.row.reminders, pending]);
}

function recordAttack(mutation: Mutation, payload: RollPayload, secret: boolean) {
  const event = recordRollEvent(mutation.tx, {
    campaignId: mutation.loaded.encounter.campaignId,
    userId: mutation.viewer.userId,
    userName: mutation.userName,
    secret,
    payload,
  });
  mutation.events.push(event);
  return event;
}

/**
 * A save row: no attack roll. Its damage, if any, is rolled once; each
 * target rolls its save and keeps what it leaves: the damage whole on a
 * failure, half or none on a success. Without damage (Graxa), a failure
 * leaves the effect for the master and a success leaves nothing.
 */
function saveAttack(
  mutation: Mutation,
  combatant: LoadedCombatant,
  chosen: Extract<Attack, { kind: 'save' }>,
  targets: LoadedCombatant[],
  secret: boolean,
  base: Pick<RollPayload, 'kind' | 'rollKind' | 'attackName' | 'attackRange' | 'characterName' | 'attackerSource' | 'characterId'>,
  extra: ParsedBonus | undefined,
) {
  const save = { dc: chosen.dc, ability: chosen.saveAbility };
  let payload: RollPayload;
  if (!hasDamage(chosen)) {
    // Only the effect: nothing to roll for the attacker.
    payload = { ...base, ...noRoll(), save };
  } else {
    const damage = rollDamage(chosen.damage, false, Math.random, extra);
    if (!damage) refuse(422, 'A expressão de dano deste ataque é inválida.');
    payload = { ...base, ...damage, mode: 'normal', damage: { ...damage, damageType: chosen.damageType }, save };
  }

  const outcomes = targets.map((target) => {
    const roll = targetSave(target, chosen);
    const amount = payload.damage ? damageAfterSave(payload.damage.total, roll.success, chosen.onSave) : 0;
    return { target, roll, amount };
  });
  if (outcomes.length > 0) {
    payload.targets = outcomes.map(({ target, roll, amount }) => ({
      ...aimedAt(target),
      hit: true,
      save: roll,
      ...(payload.damage ? { damage: amount } : {}),
    }));
  }

  const event = recordAttack(mutation, payload, secret);
  for (const { target, roll, amount } of outcomes) {
    // Left on a hidden target, it would tell a player once the target shows.
    const hiddenToo = secret || target.row.hidden;
    if (!payload.damage) {
      // Passed: nothing is left on the target. Failed: the master applies the effect.
      if (roll.success) continue;
      const called: CombatReminder = {
        id: randomUUID(),
        kind: 'pendingSave',
        dc: chosen.dc,
        ability: chosen.saveAbility,
        attackerName: combatant.name,
        attackName: chosen.name,
        notes: chosen.notes,
        eventId: event.id,
        secret: hiddenToo,
        failed: true,
      };
      writeVitals(mutation, target, {}, [...target.row.reminders, called]);
      continue;
    }
    if (amount === 0) continue;
    const pending: CombatReminder = {
      id: randomUUID(),
      kind: 'pendingDamage',
      amount,
      damageType: chosen.damageType,
      critical: false,
      attackerName: combatant.name,
      attackName: chosen.name,
      save: { ...save, success: roll.success },
      eventId: event.id,
      secret: hiddenToo,
    };
    writeVitals(mutation, target, {}, [...target.row.reminders, pending]);
  }
}

/**
 * The master applies a pending damage, adjusted or not (resistance, half on a
 * save), through the same path as any damage. Consuming it and hurting
 * happen in one write.
 */
function applyPendingDamage(mutation: Mutation, combatant: LoadedCombatant, reminderId: string | undefined, body: Record<string, unknown>) {
  requireMaster(mutation.viewer);
  const reminder = findReminder(combatant, reminderId, 'pendingDamage');
  if (reminder.kind !== 'pendingDamage') refuse(404, 'Lembrete não encontrado.');
  // Unadjusted, the damage the server rolled goes in whole: the limit is for
  // what the master types, not for a roll that may exceed it.
  const amount =
    body.amount === undefined ? reminder.amount : boundedInteger(body.amount, C.hpAmount.min, C.hpAmount.max);
  if (amount === undefined) refuse(422, `A quantidade deve ser um número entre ${C.hpAmount.min} e ${C.hpAmount.max}.`);
  applyHitPoints(mutation, combatant, 'damage', amount, withoutReminder(combatant, reminder));
}

/** Any reminder may be dismissed by who acts on the combatant; a pending damage only by the master. */
function dismissReminder(mutation: Mutation, combatant: LoadedCombatant, reminderId: string | undefined) {
  const reminder = findReminder(combatant, reminderId);
  if (reminder.kind === 'pendingDamage') requireMaster(mutation.viewer);
  writeVitals(mutation, combatant, {}, withoutReminder(combatant, reminder));
}

// --- Temporary effects ------------------------------------------------------------------

/**
 * Who may take an effect off: the master, the bearer's owner, and whoever's
 * character the effect comes from.
 */
function canRemoveEffect(mutation: Mutation, bearer: LoadedCombatant, effect: CombatEffect): boolean {
  const { viewer, loaded } = mutation;
  if (viewer.role === 'master' || bearer.ownerId === viewer.userId) return true;
  const source = loaded.combatants.find((combatant) => combatant.row.id === effect.sourceCombatantId);
  return source?.ownerId === viewer.userId;
}

/**
 * Puts an effect on a combatant, replacing one of the same name. The master
 * puts any; a player, one on their own character, or one their character is
 * the source of on an ally (the cleric's Shield of Faith on the fighter).
 */
function applyEffect(mutation: Mutation, bearer: LoadedCombatant, body: Record<string, unknown>) {
  const parsed = parseEffectInput(body);
  if (!parsed.ok) refuse(422, parsed.error);
  const input = parsed.effect;
  const { viewer } = mutation;
  const source = input.sourceCombatantId === undefined ? null : findCombatant(mutation, input.sourceCombatantId);
  if (viewer.role !== 'master') {
    if (source && source.ownerId !== viewer.userId) refuse(403, 'A origem de um efeito seu é o seu personagem.');
    const ownBearer = bearer.ownerId === viewer.userId;
    if (!ownBearer && !(source && bearer.row.source === 'character')) {
      refuse(403, 'Você põe efeitos no seu personagem, ou num aliado quando a origem é o seu personagem.');
    }
  }
  if (input.concentration && !source?.concentrating) refuse(409, `${source?.name ?? 'A origem'} não está concentrando.`);
  const { effects, replaced } = setEffect(bearer.effects, { id: randomUUID(), ...input });
  if (replaced && !canRemoveEffect(mutation, bearer, replaced)) refuse(403, `Você não pode substituir ${replaced.name}.`);
  if (!replaced && bearer.effects.length >= EFFECT_LIMITS.perCombatant) {
    refuse(409, `${bearer.name} já tem ${EFFECT_LIMITS.perCombatant} efeitos.`);
  }
  writeEffects(mutation.tx, bearer, effects, mutation.characters);
}

function removeEffect(mutation: Mutation, bearer: LoadedCombatant, effectId: string | undefined) {
  const effect = bearer.effects.find((candidate) => candidate.id === effectId);
  if (!effect) refuse(404, 'Efeito não encontrado.');
  if (!canRemoveEffect(mutation, bearer, effect)) refuse(403, 'Você só tira efeitos do seu personagem ou os que vêm dele.');
  writeEffects(mutation.tx, bearer, bearer.effects.filter((candidate) => candidate !== effect), mutation.characters);
}

function viewerOf(c: HonoContext<Context>): Viewer {
  return { role: c.var.role, userId: c.var.user.id };
}

/**
 * Every change follows the same path: read, check, apply the `shared/` rules,
 * bump `version` and write — in one SQLite transaction — then publish each
 * viewer's projection and answer with the requester's.
 */
async function mutate(
  c: HonoContext<Context>,
  run: (mutation: Mutation, body: Record<string, unknown>) => void,
  successStatus: 200 | 201 = 200,
) {
  const { db, hub } = c.var.deps;
  const viewer = viewerOf(c);
  const body = source(await c.req.json().catch(() => ({})));
  const encounterId = c.req.param('encounterId') ?? '';
  const events: SessionEvent[] = [];
  const touched = new Set<string>();
  const joined = new Set<string>();
  let shown: string[] = [];
  let waiting: Waiting[] = [];

  try {
    const loaded = db.transaction((tx) => {
      const encounter = findEncounter(tx, c.var.campaignId, encounterId);
      // A player cannot tell an encounter in preparation from a missing one.
      if (!encounter || (viewer.role !== 'master' && encounter.status === 'preparing')) refuse(404, NOT_FOUND);
      const before = loadEncounter(tx, encounter);
      // Read before the change: removing a combatant takes its token with it.
      shown = scenesOfEncounter(tx, before);
      run({ tx, loaded: before, viewer, events, characters: touched, scenes: joined, userName: c.var.user.name }, body);
      // Whatever ended a concentration (a fall, the button, a removal) ends its effects too.
      settleEffects(tx, findEncounter(tx, c.var.campaignId, encounter.id)!, touched);
      shown = [...new Set([...shown, ...joined])];
      tx.update(encounters)
        .set({ version: sql`${encounters.version} + 1` })
        .where(eq(encounters.id, encounter.id))
        .run();
      bumpScenes(tx, shown);
      const after = loadEncounter(tx, findEncounter(tx, c.var.campaignId, encounter.id)!);
      waiting = turnWaiters(before, after);
      return after;
    });

    // Before the scenes go out, so they show the token back and free.
    for (const combatant of waiting) releaseTurnDrags(c.var.deps, combatant);

    for (const event of events) hub.publish(c.var.campaignId, event);
    hub.publishCombat(c.var.campaignId, (connection) => projectEncounter(loaded, connection));
    // A token reads its combatant: hidden, renamed or removed, the map changes too.
    publishScenes(c.var.deps, c.var.campaignId, shown);
    // A sheet is shared: the other encounters it is in changed too.
    for (const characterId of touched) {
      publishCharacterEncounters(c.var.deps, c.var.campaignId, characterId, loaded.encounter.id);
    }
    return c.json({ encounter: projectEncounter(loaded, viewer) }, successStatus);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    if (!error.withState) return c.json({ error: error.message }, error.status);
    const encounter = findEncounter(db, c.var.campaignId, encounterId)!;
    return c.json({ error: error.message, encounter: projectEncounter(loadEncounter(db, encounter), viewer) }, error.status);
  }
}

type Deps = Pick<Context['Variables']['deps'], 'db' | 'hub' | 'assets' | 'locks'>;

/**
 * Drops for good the reminders a sheet change made meaningless, on every
 * combatant of the character but `except`. Filtering on read is not enough:
 * concentrating again, or falling again, would bring an old one back.
 */
export function settleCharacterReminders(tx: Executor, characterId: string, except?: string) {
  const sheet = tx
    .select({ hpCurrent: characters.hpCurrent, concentrating: characters.concentrating })
    .from(characters)
    .where(eq(characters.id, characterId))
    .get();
  if (!sheet) return;
  const rows = tx
    .select({ id: combatants.id, reminders: combatants.reminders })
    .from(combatants)
    .where(eq(combatants.characterId, characterId))
    .all();
  for (const row of rows) {
    if (row.id === except) continue;
    const kept = pendingReminders(row.reminders, sheet);
    if (kept.length !== row.reminders.length) tx.update(combatants).set({ reminders: kept }).where(eq(combatants.id, row.id)).run();
  }
}

/** The encounters not yet ended that a character takes part in. */
function openEncountersOf(tx: Executor, campaignId: string, characterId: string): string[] {
  return tx
    .select({ id: encounters.id })
    .from(encounters)
    .innerJoin(combatants, eq(combatants.encounterId, encounters.id))
    .where(
      and(
        eq(encounters.campaignId, campaignId),
        ne(encounters.status, 'ended'),
        eq(combatants.characterId, characterId),
      ),
    )
    .all()
    .map(({ id }) => id);
}

/**
 * For a change to a sheet: the open encounters the character is in, but
 * `except`, which the change already published.
 */
export function publishCharacterEncounters(deps: Deps, campaignId: string, characterId: string, except?: string) {
  const { db, hub } = deps;
  for (const id of openEncountersOf(db, campaignId, characterId)) {
    if (id === except) continue;
    const loaded = db.transaction((tx) => {
      tx.update(encounters).set({ version: sql`${encounters.version} + 1` }).where(eq(encounters.id, id)).run();
      return loadEncounter(tx, findEncounter(tx, campaignId, id)!);
    });
    hub.publishCombat(campaignId, (viewer) => projectEncounter(loaded, viewer));
  }
}

/**
 * Deletes a character that may be fighting. The cascade takes its combatants
 * away, so first the turn passes on in every open encounter it was in, as if
 * the master had removed it, and those encounters reach every connection.
 */
export function deleteCharacter(deps: Deps, campaignId: string, characterId: string) {
  const { db, hub } = deps;
  let shown: string[] = [];
  const changed = db.transaction((tx) => {
    // Its token goes with it.
    shown = scenesShowing(tx, { characterId });
    bumpScenes(tx, shown);
    const ids = openEncountersOf(tx, campaignId, characterId);
    for (const id of ids) {
      const loaded = loadEncounter(tx, findEncounter(tx, campaignId, id)!);
      const combatant = loaded.combatants.find((candidate) => candidate.row.characterId === characterId)!;
      handOffTurn(tx, loaded, combatant.row.id);
      tx.update(encounters).set({ version: sql`${encounters.version} + 1` }).where(eq(encounters.id, id)).run();
    }
    tx.delete(characters).where(and(eq(characters.id, characterId), eq(characters.campaignId, campaignId))).run();
    return ids.map((id) => loadEncounter(tx, findEncounter(tx, campaignId, id)!));
  });
  for (const loaded of changed) hub.publishCombat(campaignId, (viewer) => projectEncounter(loaded, viewer));
  publishScenes(deps, campaignId, shown);
}

/** For a change to a sheet: the scenes where the character's token shows its name, size and avatar. */
export function publishCharacterScenes(deps: Deps, campaignId: string, characterId: string) {
  const shown = deps.db.transaction((tx) => {
    const ids = scenesShowing(tx, { characterId });
    bumpScenes(tx, ids);
    return ids;
  });
  publishScenes(deps, campaignId, shown);
}

/**
 * Encounters of a campaign. The master prepares and runs them; a player sees
 * only the active and the ended ones, through the same projection the socket
 * uses. Non-members get 404 from `requireCampaignRole`.
 */
export function encounterRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth, requireCampaignRole());

  routes.get('/', (c) => {
    const { db } = c.var.deps;
    const conditions = [eq(encounters.campaignId, c.var.campaignId)];
    if (c.var.role !== 'master') conditions.push(ne(encounters.status, 'preparing'));
    const rows = db
      .select({
        id: encounters.id,
        name: encounters.name,
        status: encounters.status,
        round: encounters.round,
        createdAt: encounters.createdAt,
        endedAt: encounters.endedAt,
        // A player's count leaves the hidden combatants out.
        combatantCount:
          c.var.role === 'master'
            ? sql<number>`(select count(*) from ${combatants} where ${combatants.encounterId} = ${encounters.id})`
            : sql<number>`(select count(*) from ${combatants} where ${combatants.encounterId} = ${encounters.id} and ${combatants.hidden} = 0)`,
      })
      .from(encounters)
      .where(and(...conditions))
      .orderBy(desc(encounters.createdAt), desc(sql`${encounters}.rowid`))
      .all();
    const list: EncounterListItem[] = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
    }));
    return c.json({ encounters: list });
  });

  routes.post('/', async (c) => {
    if (c.var.role !== 'master') return c.json({ error: MASTER_ONLY }, 403);
    const { db } = c.var.deps;
    const body = source(await c.req.json().catch(() => ({})));
    const name = shortText(body.name, E.name);
    if (!name) return c.json({ error: `Dê um nome ao encontro, com até ${E.name} caracteres.` }, 422);
    const row = db.insert(encounters).values({ id: randomUUID(), campaignId: c.var.campaignId, name }).returning().get();
    return c.json({ encounter: projectEncounter(loadEncounter(db, row), viewerOf(c)) }, 201);
  });

  routes.get('/:encounterId', (c) => {
    const { db } = c.var.deps;
    const encounter = findEncounter(db, c.var.campaignId, c.req.param('encounterId'));
    const view = encounter ? projectEncounter(loadEncounter(db, encounter), viewerOf(c)) : null;
    if (!view) return c.json({ error: NOT_FOUND }, 404);
    return c.json({ encounter: view });
  });

  routes.patch('/:encounterId', (c) =>
    mutate(c, (mutation, body) => {
      requireMaster(mutation.viewer);
      requireOpen(mutation.loaded.encounter);
      const name = shortText(body.name, E.name);
      if (!name) refuse(422, `Dê um nome ao encontro, com até ${E.name} caracteres.`);
      setEncounter(mutation, { name });
    }),
  );

  routes.delete('/:encounterId', (c) => {
    const { db } = c.var.deps;
    const encounter = findEncounter(db, c.var.campaignId, c.req.param('encounterId'));
    if (!encounter || (c.var.role !== 'master' && encounter.status === 'preparing')) {
      return c.json({ error: NOT_FOUND }, 404);
    }
    if (c.var.role !== 'master') return c.json({ error: MASTER_ONLY }, 403);
    if (encounter.status === 'active') return c.json({ error: 'Encerre o combate antes de excluí-lo.' }, 409);
    const shown = db.transaction((tx) => {
      // Read before the delete, which takes the combatants and their tokens.
      const combatantIds = tx.select({ id: combatants.id }).from(combatants).where(eq(combatants.encounterId, encounter.id)).all();
      const ids = scenesShowing(tx, { combatantIds: combatantIds.map(({ id }) => id) });
      tx.delete(encounters).where(eq(encounters.id, encounter.id)).run();
      bumpScenes(tx, ids);
      return ids;
    });
    publishScenes(c.var.deps, c.var.campaignId, shown);
    // Whoever has it open must learn it is gone; one in preparation was never a player's.
    c.var.deps.hub.publishCombatDeleted(
      c.var.campaignId,
      encounter.id,
      (viewer) => viewer.role === 'master' || encounter.status !== 'preparing',
    );
    return c.body(null, 204);
  });

  routes.post('/:encounterId/start', (c) => mutate(c, startEncounter));
  routes.post('/:encounterId/end', (c) => mutate(c, endEncounter));
  routes.post('/:encounterId/turn', (c) => mutate(c, changeTurn));

  // Rolls every monster still without initiative; the characters are their players'.
  routes.post('/:encounterId/initiative', (c) =>
    mutate(c, (mutation, body) => {
      requireMaster(mutation.viewer);
      requireOpen(mutation.loaded.encounter);
      if (body.secret !== undefined && typeof body.secret !== 'boolean') refuse(422, 'Valor inválido para "secreta".');
      const secret = (body.secret as boolean | undefined) ?? true;
      const pending = mutation.loaded.combatants.filter(
        (combatant) => combatant.row.source !== 'character' && combatant.row.initiative === null,
      );
      if (pending.length === 0) refuse(409, 'Todas as criaturas já têm iniciativa.');
      for (const combatant of pending) rollInitiative(mutation, combatant, { mode: 'normal', secret });
    }),
  );

  routes.put('/:encounterId/tie-order', (c) =>
    mutate(c, (mutation, body) => {
      requireMaster(mutation.viewer);
      requireOpen(mutation.loaded.encounter);
      setTieOrder(mutation, body);
    }),
  );

  routes.post('/:encounterId/combatants', (c) =>
    mutate(
      c,
      (mutation, body) => {
        requireMaster(mutation.viewer);
        requireOpen(mutation.loaded.encounter);
        addCombatants(mutation, body);
      },
      201,
    ),
  );

  routes.patch('/:encounterId/combatants/:combatantId', (c) =>
    mutate(c, (mutation, body) => {
      const combatant = findCombatant(mutation, c.req.param('combatantId'));
      requireMaster(mutation.viewer);
      requireOpen(mutation.loaded.encounter);
      editCombatant(mutation, combatant, body);
    }),
  );

  routes.delete('/:encounterId/combatants/:combatantId', (c) =>
    mutate(c, (mutation) => {
      const combatant = findCombatant(mutation, c.req.param('combatantId'));
      requireMaster(mutation.viewer);
      requireOpen(mutation.loaded.encounter);
      removeCombatant(mutation, combatant);
    }),
  );

  routes.post('/:encounterId/combatants/:combatantId/initiative', (c) =>
    mutate(c, (mutation, body) => {
      const combatant = findCombatant(mutation, c.req.param('combatantId'));
      requireOpen(mutation.loaded.encounter);
      setInitiative(mutation, combatant, body);
    }),
  );

  /**
   * What happens to one combatant during the fight: the master acts on any of
   * them, a player only on their own character, and only while it runs.
   */
  const duringFight = (
    c: HonoContext<Context>,
    act: (mutation: Mutation, combatant: LoadedCombatant, body: Record<string, unknown>) => void,
  ) =>
    mutate(c, (mutation, body) => {
      const combatant = findCombatant(mutation, c.req.param('combatantId') ?? '');
      requireOwnOrMaster(mutation, combatant);
      requireActive(mutation.loaded.encounter);
      act(mutation, combatant, body);
    });

  const combatant = '/:encounterId/combatants/:combatantId';
  routes.post(`${combatant}/hp`, (c) => duringFight(c, changeHitPoints));
  routes.put(`${combatant}/conditions/:condition`, (c) =>
    duringFight(c, (mutation, target, body) => applyCondition(mutation, target, parseCondition(c.req.param('condition'), body))),
  );
  routes.delete(`${combatant}/conditions/:condition`, (c) =>
    duringFight(c, (mutation, target) => dropCondition(mutation, target, c.req.param('condition'))),
  );
  routes.put(`${combatant}/concentration`, (c) => duringFight(c, setConcentration));
  routes.post(`${combatant}/death-save`, (c) => duringFight(c, deathSave));
  routes.post(`${combatant}/concentration-save`, (c) => duringFight(c, concentrationSave));
  routes.delete(`${combatant}/reminders/:reminderId`, (c) =>
    duringFight(c, (mutation, target) => dismissReminder(mutation, target, c.req.param('reminderId'))),
  );
  routes.post(`${combatant}/reminders/:reminderId/apply`, (c) =>
    duringFight(c, (mutation, target, body) => applyPendingDamage(mutation, target, c.req.param('reminderId'), body)),
  );
  routes.post(`${combatant}/attack`, (c) => duringFight(c, attack));
  routes.post(`${combatant}/economy`, (c) => duringFight(c, changeEconomy));

  /** Effects: who may act depends on the bearer and the source, so each handler checks. */
  const onEffects = (
    c: HonoContext<Context>,
    act: (mutation: Mutation, bearer: LoadedCombatant, body: Record<string, unknown>) => void,
  ) =>
    mutate(c, (mutation, body) => {
      const bearer = findCombatant(mutation, c.req.param('combatantId') ?? '');
      requireActive(mutation.loaded.encounter);
      act(mutation, bearer, body);
    });
  routes.post(`${combatant}/effects`, (c) => onEffects(c, applyEffect));
  routes.delete(`${combatant}/effects/:effectId`, (c) =>
    onEffects(c, (mutation, bearer) => removeEffect(mutation, bearer, c.req.param('effectId'))),
  );

  return routes;
}
