import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { Hono, type Context as HonoContext } from 'hono';
import { characters, combatants, encounters, statblocks, type EncounterRow } from '@quest-fast/db';
import {
  COMBAT_LIMITS as C,
  ENCOUNTER_LIMITS as E,
  EXHAUSTION_MAX,
  HP_OPERATIONS,
  STATBLOCK_LIMITS as S,
  abilityModifier,
  applyHpChange,
  copyNumber,
  damageReminders,
  deathSaveFailure,
  deathSaveOutcome,
  deathSaveStatus,
  hasPreviousTurn,
  initiative as sheetInitiative,
  isCondition,
  isDefeated,
  isHit,
  isRollMode,
  isSize,
  nextTurn,
  pendingReminders,
  placeCopies,
  previousTurn,
  removeCondition,
  rollAttackHit,
  rollDamage,
  rollDice,
  saveBonus,
  setCondition,
  tickConditions,
  type ActiveCondition,
  healthBand,
  type CombatPayload,
  type CombatReminder,
  type CopyEntry,
  type DeathSaves,
  type EncounterListItem,
  type HpOperation,
  type RollMode,
  type RollPayload,
  type SessionEvent,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { recordCombatEvent, recordRollEvent } from '../events/feed.ts';
import type { Viewer } from '../events/hub.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { boundedInteger, shortText } from '../validation.ts';
import { projectEncounter } from './projection.ts';
import { attacksOf, findEncounter, loadEncounter, queueOrder, turnOrder, type Executor, type LoadedCombatant, type LoadedEncounter } from './state.ts';

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
}

function rollInitiative(
  mutation: Mutation,
  combatant: LoadedCombatant,
  options: { mode: RollMode; secret: boolean },
) {
  const { row, sheet } = combatant;
  const bonus = sheet ? sheetInitiative(sheet) : row.dexModifier + row.initiativeBonus;
  const result = rollDice(`1d20${bonus >= 0 ? '+' : ''}${bonus}`, options.mode)!;
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

/** The encounter's names as `placeCopies` sees them: only bestiary copies are renumbered. */
function copyEntries(loaded: readonly LoadedCombatant[]): CopyEntry[] {
  return loaded.map(({ row, name }) => ({ id: row.id, name, hidden: row.hidden, renamable: row.source === 'statblock' }));
}

/**
 * The bestiary name a combatant is a numbered copy of. Only the creature's
 * name tells a copy number from a number in the name; with the creature
 * renamed or deleted, or the copy renamed by the master, there is none.
 */
function copiedCreature(tx: Executor, row: LoadedCombatant['row']): string | null {
  if (row.source !== 'statblock' || !row.statblockId) return null;
  const creature = tx.select({ name: statblocks.name }).from(statblocks).where(eq(statblocks.id, row.statblockId)).get();
  return creature && copyNumber(row.name, creature.name) !== null ? creature.name : null;
}

function renameCopies(tx: Executor, renamed: readonly { id: string; name: string }[]) {
  for (const { id, name } of renamed) tx.update(combatants).set({ name }).where(eq(combatants.id, id)).run();
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
    const statblock = tx
      .select()
      .from(statblocks)
      .where(and(eq(statblocks.id, statblockId), eq(statblocks.campaignId, campaignId)))
      .get();
    if (!statblock) refuse(404, 'Criatura não encontrada.');
    const count = boundedInteger(body.count ?? 1, 1, E.copies);
    if (count === undefined) refuse(422, `A quantidade deve ser um número entre 1 e ${E.copies}.`);
    if (existing + count > E.combatants) refuse(422, `Limite de ${E.combatants} combatentes por encontro.`);
    const hp = body.hp ?? 'average';
    if (hp !== 'average' && hp !== 'rolled') refuse(422, 'Escolha PV médio ou rolado.');
    if (hp === 'rolled' && !statblock.hpFormula) refuse(422, `${statblock.name} não tem fórmula de PV para rolar.`);

    const { names, renamed } = placeCopies(statblock.name, count, hidden, copyEntries(loaded.combatants));
    renameCopies(tx, renamed);
    for (const name of names) {
      // A roll can land below 1 with a negative modifier; a creature starts standing.
      const hpMax = hp === 'rolled' ? Math.max(1, rollDice(statblock.hpFormula)!.total) : statblock.hpAverage;
      tx.insert(combatants)
        .values({
          id: randomUUID(),
          encounterId,
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
          attacks: statblock.attacks,
          hidden,
        })
        .run();
    }
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

  const sheetFields = ['name', 'ac', 'hpMax'].filter((key) => body[key] !== undefined);
  if (sheetFields.length > 0 && row.source === 'character') {
    refuse(422, 'Nome, CA e PV de um personagem são alterados na ficha.');
  }
  if (body.name !== undefined) {
    const name = shortText(body.name, S.name);
    if (!name) refuse(422, `Informe o nome do combatente, com até ${S.name} caracteres.`);
    changes.name = name;
  } else if (row.hidden && changes.hidden === false) {
    // A revealed copy takes the next visible number, so the players never see a gap.
    const creature = copiedCreature(mutation.tx, row);
    if (creature) {
      const others = mutation.loaded.combatants.filter((other) => other.row.id !== row.id);
      const { names, renamed } = placeCopies(creature, 1, false, copyEntries(others));
      renameCopies(mutation.tx, renamed);
      changes.name = names[0];
    }
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
    changes.hpCurrent =
      mutation.loaded.encounter.status === 'preparing' ? hpMax : Math.min(row.hpCurrent ?? hpMax, hpMax);
  }
  if (Object.keys(changes).length === 0) refuse(422, 'Nada para alterar.');
  mutation.tx.update(combatants).set(changes).where(eq(combatants.id, row.id)).run();
}

/**
 * Passes the turn on when the active combatant is about to leave. Runs before
 * the combatant goes, so its position in the queue is still known.
 */
function handOffTurn(tx: Executor, loaded: LoadedEncounter, combatantId: string) {
  const { encounter } = loaded;
  if (encounter.activeCombatantId !== combatantId) return;
  const next = nextTurn(turnOrder(loaded), encounter.activeCombatantId, encounter.round);
  tx.update(encounters)
    .set({ activeCombatantId: next.activeId === combatantId ? null : next.activeId, round: next.round })
    .where(eq(encounters.id, encounter.id))
    .run();
}

function removeCombatant(mutation: Mutation, combatant: LoadedCombatant) {
  handOffTurn(mutation.tx, mutation.loaded, combatant.row.id);
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
  rollInitiative(mutation, combatant, { mode, secret });
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
    if (encounter.round === 0) refuse(409, 'O primeiro round ainda não começou.');
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
  }
  const next = nextTurn(turnOrder(loaded), encounter.activeCombatantId, encounter.round);
  setEncounter(mutation, { activeCombatantId: next.activeId, round: next.round });
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
  const drafts =
    operation === 'damage'
      ? damageReminders({ amount, hpCurrentBefore: before.hpCurrent, concentrating: combatant.concentrating, source: combatant.row.source })
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
    if (body.failures !== 1 && body.failures !== 2) refuse(422, 'Registre uma ou duas falhas.');
    const reminders =
      body.reminderId === undefined ? row.reminders : withoutReminder(combatant, findReminder(combatant, body.reminderId, 'deathFailure'));
    const saves = deathSaveFailure(sheet.deathSaves, body.failures);
    writeVitals(mutation, combatant, { deathSaves: saves }, reminders);
    tell(mutation, combatant, { kind: 'combat.deathSave', ...about(mutation, combatant), failures: body.failures, saves, outcome: deathSaveStatus(saves) });
    return;
  }

  if (status === 'stable') refuse(409, `${name} está estável e não rola mais testes contra a morte.`);
  const { encounter } = mutation.loaded;
  if (mutation.viewer.role !== 'master') {
    if (encounter.activeCombatantId !== row.id) refuse(409, 'Role o teste contra a morte na sua vez.');
    if (row.deathSaveRound === encounter.round) refuse(409, 'Você já rolou o teste contra a morte nesta rodada.');
  }
  const d20 = rollDice('1d20')!.dice[0]!.value;
  const outcome = deathSaveOutcome(d20, sheet.deathSaves);
  const vitals: Vitals = { deathSaves: outcome.saves };
  if (outcome.hpCurrent !== undefined) vitals.hpCurrent = outcome.hpCurrent;
  writeVitals(mutation, combatant, vitals);
  mutation.tx.update(combatants).set({ deathSaveRound: encounter.round }).where(eq(combatants.id, row.id)).run();
  tell(mutation, combatant, { kind: 'combat.deathSave', ...about(mutation, combatant), d20, saves: outcome.saves, outcome: outcome.status });
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
  if (body.secret !== undefined && typeof body.secret !== 'boolean') refuse(422, 'Valor inválido para "secreta".');
  const { row, sheet } = combatant;
  // A monster's roll is the master's unless told otherwise; a character's is the table's.
  const secret = mutation.viewer.role === 'master' ? ((body.secret as boolean | undefined) ?? row.source !== 'character') : false;
  const bonus = sheet ? saveBonus(sheet, 'constitution') : row.constitutionModifier;
  const result = rollDice(`1d20${bonus >= 0 ? '+' : ''}${bonus}`, mode)!;
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
 * An attack, rolled on the server. With a target, the attack roll is
 * compared with its AC and a hit rolls the damage, left pending on the
 * target for the master to apply. Without one, only the attack roll is made
 * and its damage can be rolled later, once. Reactions happen out of turn, so
 * the turn is not checked.
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
  if (chosen.kind === 'save' && mode !== 'normal') {
    refuse(422, 'Vantagem e desvantagem não se aplicam a um ataque por salvaguarda.');
  }
  if (body.secret !== undefined && typeof body.secret !== 'boolean') refuse(422, 'Valor inválido para "secreta".');
  const master = mutation.viewer.role === 'master';
  if (!master && body.secret === true) refuse(403, 'Apenas o mestre pode rolar em segredo.');

  let target: LoadedCombatant | undefined;
  if (body.targetId !== undefined && body.targetId !== null) {
    if (typeof body.targetId !== 'string') refuse(422, 'Alvo inválido.');
    target = findCombatant(mutation, body.targetId);
    if (target.row.id === row.id) refuse(422, 'Escolha outro combatente como alvo.');
  }

  // A monster's attack is the master's unless told otherwise, like its
  // initiative; a character's is the table's. A hidden attacker or target
  // would be given away by the event.
  const secret =
    (master ? ((body.secret as boolean | undefined) ?? row.source !== 'character') : false) ||
    row.hidden ||
    target?.row.hidden === true;

  const base = {
    kind: 'roll' as const,
    rollKind: 'attack' as const,
    attackName: chosen.name,
    characterName: combatant.name,
    attackerSource: sourceOf(combatant),
    ...(row.characterId ? { characterId: row.characterId } : {}),
  };
  const aimed = target ? { combatantId: target.row.id, name: target.name, source: sourceOf(target) } : undefined;

  let payload: RollPayload;
  if (chosen.kind === 'save') {
    const damage = rollDamage(chosen.damage, false);
    if (!damage) refuse(422, 'A expressão de dano deste ataque é inválida.');
    payload = {
      ...base,
      ...damage,
      mode: 'normal',
      damage: { ...damage, damageType: chosen.damageType },
      save: { dc: chosen.dc, ability: chosen.saveAbility },
      ...(aimed ? { target: { ...aimed, hit: true } } : {}),
    };
  } else {
    const roll = rollAttackHit(chosen.bonus, mode);
    const { critical, ...result } = roll;
    payload = { ...base, ...result, critical };
    if (!target || !aimed) {
      payload.damageRollable = { expression: chosen.damage, damageType: chosen.damageType };
    } else {
      const hit = isHit(roll, target.ac);
      payload.target = { ...aimed, hit, ac: target.ac };
      if (hit) {
        const damage = rollDamage(chosen.damage, critical);
        if (!damage) refuse(422, 'O dano deste ataque passa do limite de dados no crítico ou é inválido.');
        payload.damage = { ...damage, damageType: chosen.damageType };
      }
    }
  }

  const event = recordRollEvent(mutation.tx, {
    campaignId: mutation.loaded.encounter.campaignId,
    userId: mutation.viewer.userId,
    userName: mutation.userName,
    secret,
    payload,
  });
  mutation.events.push(event);

  if (!target || !payload.damage || payload.damage.total === 0) return;
  const pending: CombatReminder = {
    id: randomUUID(),
    kind: 'pendingDamage',
    amount: payload.damage.total,
    damageType: chosen.damageType,
    critical: payload.critical === true,
    attackerName: combatant.name,
    attackName: chosen.name,
    ...(payload.save ? { save: payload.save } : {}),
    eventId: event.id,
    secret,
  };
  writeVitals(mutation, target, {}, [...target.row.reminders, pending]);
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

  try {
    const loaded = db.transaction((tx) => {
      const encounter = findEncounter(tx, c.var.campaignId, encounterId);
      // A player cannot tell an encounter in preparation from a missing one.
      if (!encounter || (viewer.role !== 'master' && encounter.status === 'preparing')) refuse(404, NOT_FOUND);
      run({ tx, loaded: loadEncounter(tx, encounter), viewer, events, characters: touched, userName: c.var.user.name }, body);
      tx.update(encounters)
        .set({ version: sql`${encounters.version} + 1` })
        .where(eq(encounters.id, encounter.id))
        .run();
      return loadEncounter(tx, findEncounter(tx, c.var.campaignId, encounter.id)!);
    });

    for (const event of events) hub.publish(c.var.campaignId, event);
    hub.publishCombat(c.var.campaignId, (connection) => projectEncounter(loaded, connection));
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

type Deps = Pick<Context['Variables']['deps'], 'db' | 'hub'>;

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
  const changed = db.transaction((tx) => {
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
    db.delete(encounters).where(eq(encounters.id, encounter.id)).run();
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

  return routes;
}
