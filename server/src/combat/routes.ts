import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { Hono, type Context as HonoContext } from 'hono';
import { characters, combatants, encounters, statblocks, type EncounterRow } from '@quest-fast/db';
import {
  ENCOUNTER_LIMITS as E,
  STATBLOCK_LIMITS as S,
  abilityModifier,
  hasPreviousTurn,
  initiative as sheetInitiative,
  isRollMode,
  isSize,
  nextTurn,
  numberCopies,
  previousTurn,
  rollDice,
  tickConditions,
  type EncounterListItem,
  type RollMode,
  type SessionEvent,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { recordCombatEvent, recordRollEvent } from '../events/feed.ts';
import type { Viewer } from '../events/hub.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { boundedInteger, shortText } from '../validation.ts';
import { projectEncounter } from './projection.ts';
import { findEncounter, loadEncounter, queueOrder, turnOrder, type Executor, type LoadedCombatant, type LoadedEncounter } from './state.ts';

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

    const names = numberCopies(
      statblock.name,
      count,
      loaded.combatants.map((combatant) => combatant.name),
    );
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
  // Durations run out at the end of the affected combatant's own turn. The
  // feed entry for an expired condition arrives with conditions themselves.
  if (active) {
    const { remaining } = tickConditions(active.conditions);
    if (active.row.characterId) {
      mutation.tx.update(characters).set({ conditions: remaining }).where(eq(characters.id, active.row.characterId)).run();
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

  try {
    const loaded = db.transaction((tx) => {
      const encounter = findEncounter(tx, c.var.campaignId, encounterId);
      // A player cannot tell an encounter in preparation from a missing one.
      if (!encounter || (viewer.role !== 'master' && encounter.status === 'preparing')) refuse(404, NOT_FOUND);
      run({ tx, loaded: loadEncounter(tx, encounter), viewer, events, userName: c.var.user.name }, body);
      tx.update(encounters)
        .set({ version: sql`${encounters.version} + 1` })
        .where(eq(encounters.id, encounter.id))
        .run();
      return loadEncounter(tx, findEncounter(tx, c.var.campaignId, encounter.id)!);
    });

    for (const event of events) hub.publish(c.var.campaignId, event);
    hub.publishCombat(c.var.campaignId, (connection) => projectEncounter(loaded, connection));
    return c.json({ encounter: projectEncounter(loaded, viewer) }, successStatus);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    if (!error.withState) return c.json({ error: error.message }, error.status);
    const encounter = findEncounter(db, c.var.campaignId, encounterId)!;
    return c.json({ error: error.message, encounter: projectEncounter(loadEncounter(db, encounter), viewer) }, error.status);
  }
}

type Deps = Pick<Context['Variables']['deps'], 'db' | 'hub'>;

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

/** For a change made outside the combat routes — a sheet's hit points, say. */
export function publishCharacterEncounters(deps: Deps, campaignId: string, characterId: string) {
  const { db, hub } = deps;
  for (const id of openEncountersOf(db, campaignId, characterId)) {
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

  return routes;
}
