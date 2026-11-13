import { randomUUID } from 'node:crypto';
import { and, count, eq, inArray } from 'drizzle-orm';
import { Hono, type Context as HonoContext } from 'hono';
import { campaigns, characters, combatants, encounters, scenes, statblocks, tokens, type SceneRow, type TokenRow } from '@quest-fast/db';
import {
  TOKEN_LIMITS as T,
  clampToMap,
  isSize,
  isTokenVisible,
  snapToCell,
  tokenDiameter,
  type Size,
} from '@quest-fast/shared';
import type { Context, Deps } from '../context.ts';
import type { Executor } from '../combat/state.ts';
import type { Viewer } from '../events/hub.ts';
import { shortText } from '../validation.ts';
import type { HeldLock } from './locks.ts';
import { moveRule, publishEncounter, spendMove } from './fight.ts';
import { tokenVisibleTo, type LoadedScene, type LoadedToken } from './projection.ts';
import {
  answer,
  bodyOf,
  bumpVersion,
  findScene,
  gridOf,
  loadScene,
  publish,
  publishScene,
  refuse,
  refused,
  requireMaster,
  scopeOf,
  viewerOf,
} from './store.ts';

const TOKEN_NOT_FOUND = 'Token não encontrado.';
const FULL = `A cena já tem o máximo de ${T.perScene} tokens.`;

/** Tokens a row of "colocar o encontro" holds before starting another. */
const ROW_LENGTH = 8;

/** A position in the body: finite numbers, nothing else. */
function parsePoint(body: Record<string, unknown>): { x: number; y: number } {
  const { x, y } = body;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    refuse(422, 'Informe a posição do token no mapa.');
  }
  return { x, y };
}

/** Where a token of this size rests when dropped at (x, y): on the grid, on the map. */
function restingPoint(scene: SceneRow, size: Size, x: number, y: number) {
  const snapped = snapToCell(x, y, gridOf(scene), size);
  return clampToMap(snapped.x, snapped.y, scene.mapWidth, scene.mapHeight);
}

function tokenCount(db: Executor, sceneId: string): number {
  return db.select({ n: count() }).from(tokens).where(eq(tokens.sceneId, sceneId)).get()?.n ?? 0;
}

function onScene(db: Executor, sceneId: string, column: typeof tokens.characterId | typeof tokens.combatantId, id: string) {
  return db.select({ id: tokens.id }).from(tokens).where(and(eq(tokens.sceneId, sceneId), eq(column, id))).get() !== undefined;
}

/** A combatant of an encounter of the campaign that is not over. */
function openCombatant(db: Executor, campaignId: string, combatantId: string) {
  return db
    .select({ combatant: combatants, status: encounters.status })
    .from(combatants)
    .innerJoin(encounters, eq(encounters.id, combatants.encounterId))
    .where(and(eq(combatants.id, combatantId), eq(encounters.campaignId, campaignId)))
    .get();
}

type NewToken = Omit<typeof tokens.$inferInsert, 'id' | 'sceneId' | 'x' | 'y'> & { size: Size };

/** Reads what the master asked to put on the scene; the size is the origin's. */
function parseNewToken(c: HonoContext<Context>, db: Executor, scene: SceneRow, body: Record<string, unknown>): NewToken {
  const { campaignId } = c.var;
  switch (body.kind) {
    case 'character': {
      const character = typeof body.characterId === 'string'
        ? db.select().from(characters).where(and(eq(characters.id, body.characterId), eq(characters.campaignId, campaignId))).get()
        : undefined;
      if (!character) refuse(404, 'Personagem não encontrado.');
      if (onScene(db, scene.id, tokens.characterId, character.id)) refuse(409, `${character.name} já está nesta cena.`);
      return { kind: 'character', characterId: character.id, size: character.size };
    }
    case 'combatant': {
      const found = typeof body.combatantId === 'string' ? openCombatant(db, campaignId, body.combatantId) : undefined;
      if (!found || found.status === 'ended') refuse(404, 'Combatente não encontrado.');
      const { combatant } = found;
      // A character is drawn once, by its own token.
      if (combatant.characterId) return parseNewToken(c, db, scene, { kind: 'character', characterId: combatant.characterId });
      if (onScene(db, scene.id, tokens.combatantId, combatant.id)) refuse(409, `${combatant.name} já está nesta cena.`);
      return { kind: 'combatant', combatantId: combatant.id, size: combatant.size };
    }
    case 'statblock': {
      const statblock = typeof body.statblockId === 'string'
        ? db.select().from(statblocks).where(and(eq(statblocks.id, body.statblockId), eq(statblocks.campaignId, campaignId))).get()
        : undefined;
      if (!statblock) refuse(404, 'Criatura não encontrada no bestiário.');
      return { kind: 'free', statblockId: statblock.id, label: statblock.name.slice(0, T.label), size: statblock.size };
    }
    case 'free': {
      const label = shortText(body.label, T.label);
      if (!label) refuse(422, `Dê um nome ao token, com até ${T.label} caracteres.`);
      if (!isSize(body.size)) refuse(422, 'Tamanho do token inválido.');
      return { kind: 'free', label, size: body.size };
    }
    default:
      refuse(422, 'Origem do token inválida: personagem, combatente, bestiário ou livre.');
  }
}

function insertToken(db: Executor, scene: SceneRow, token: NewToken, x: number, y: number) {
  const { size, ...columns } = token;
  db.insert(tokens)
    .values({
      ...columns,
      // Only a free token keeps its own size; the others read the origin's.
      size: token.kind === 'free' ? size : null,
      id: randomUUID(),
      sceneId: scene.id,
      ...restingPoint(scene, size, x, y),
    })
    .run();
}

/**
 * The token a request is about, as the viewer may know it: a player cannot
 * tell a token they do not see from a missing one.
 */
function findToken(c: HonoContext<Context>, loaded: LoadedScene): LoadedToken {
  const token = loaded.tokens.find((candidate) => candidate.row.id === c.req.param('tokenId'));
  if (!token || !tokenVisibleTo(token, viewerOf(c))) refuse(404, TOKEN_NOT_FOUND);
  return token;
}

/** The master moves any token; a player only their own character's. */
function requireMover(c: HonoContext<Context>, token: LoadedToken) {
  if (c.var.role === 'master') return;
  if (token.row.kind !== 'character' || token.ownerId !== c.var.user.id) refuse(403, 'Você só move o token do seu personagem.');
}

/** 409 when someone else is dragging the token. */
function requireNoOtherHolder(c: HonoContext<Context>, tokenId: string) {
  const holder = c.var.deps.locks.holder(tokenId);
  if (holder && holder.userId !== c.var.user.id) {
    refuse(409, `${holder.userName} está movendo este token.`, { movingBy: { userId: holder.userId, name: holder.userName } });
  }
}

/** Runs a change to the scene's tokens in one transaction, then publishes and answers with the scene. */
async function change(
  c: HonoContext<Context>,
  run: (tx: Executor, loaded: LoadedScene, body: Record<string, unknown>) => void,
  { status = 200 as 200 | 201, after }: { status?: 200 | 201; after?: () => void } = {},
) {
  const { db } = c.var.deps;
  try {
    const body = bodyOf(await c.req.json().catch(() => ({})));
    const loaded = db.transaction((tx) => {
      const current = findScene(c, tx);
      run(tx, current, body);
      bumpVersion(tx, current.scene.id);
      return loadScene(scopeOf(c), tx, current.scene.id)!;
    });
    after?.();
    // Reloaded after `after`, which may release a lock the answer shows.
    const fresh = after ? (loadScene(scopeOf(c), db, loaded.scene.id) ?? loaded) : loaded;
    publish(c, fresh);
    return answer(c, fresh, status);
  } catch (error) {
    return refused(c, error);
  }
}

/**
 * Who may receive the moves of a token: the master always; a player only on
 * the scene open for the table, and only a token they see where it was. Read
 * on every move, so hiding a token mid-drag takes effect at once. Null when
 * the token is gone or not of this campaign.
 */
export function movingAudience(db: Executor, campaignId: string, tokenId: string): ((viewer: Viewer) => boolean) | null {
  const row = db
    .select({
      kind: tokens.kind,
      hidden: tokens.hidden,
      sceneId: tokens.sceneId,
      combatantHidden: combatants.hidden,
      activeSceneId: campaigns.activeSceneId,
    })
    .from(tokens)
    .innerJoin(scenes, eq(scenes.id, tokens.sceneId))
    .innerJoin(campaigns, eq(campaigns.id, scenes.campaignId))
    .leftJoin(combatants, eq(combatants.id, tokens.combatantId))
    .where(and(eq(tokens.id, tokenId), eq(scenes.campaignId, campaignId)))
    .get();
  if (!row) return null;
  const open = row.activeSceneId === row.sceneId;
  const visibility = { kind: row.kind, hidden: row.hidden, combatantHidden: row.combatantHidden ?? false };
  return (viewer) => viewer.role === 'master' || (open && isTokenVisible(visibility, viewer.role));
}

/**
 * Saves where an abandoned lock left its token — the holder's socket closed,
 * or no move arrived in time — and tells the table the token is free.
 */
export function settleAbandonedLock(deps: Deps, lock: HeldLock) {
  const scope = { deps, campaignId: lock.campaignId };
  const loaded = deps.db.transaction((tx) => {
    const current = loadScene(scope, tx, lock.sceneId);
    const token = current?.tokens.find((candidate) => candidate.row.id === lock.tokenId);
    if (!current || !token) return undefined;
    // A holder who lost sight of the token (hidden meanwhile) leaves it where it was.
    const holder = { role: lock.role, userId: lock.userId };
    const mayMove = lock.role === 'master' || (token.row.kind === 'character' && token.ownerId === lock.userId);
    // A fighter's move counts only once confirmed: an abandoned one goes back.
    if (lock.last && mayMove && !token.fighter && tokenVisibleTo(token, holder)) {
      const position = restingPoint(current.scene, token.size, lock.last.x, lock.last.y);
      tx.update(tokens).set(position).where(eq(tokens.id, token.row.id)).run();
    }
    bumpVersion(tx, current.scene.id);
    return loadScene(scope, tx, current.scene.id);
  });
  if (loaded) publishScene(deps, lock.campaignId, loaded);
}

/**
 * The tokens of a scene. The master adds, hides, renames and removes them; a
 * player moves only their own character's token. A drag is grab → moves over
 * the socket → `PATCH` with the drop, which saves, releases the lock and
 * publishes.
 */
export function tokenRoutes() {
  const routes = new Hono<Context>();

  routes.post('/', (c) =>
    change(
      c,
      (tx, loaded, body) => {
        requireMaster(c);
        const point = parsePoint(body);
        const token = parseNewToken(c, tx, loaded.scene, body);
        if (tokenCount(tx, loaded.scene.id) >= T.perScene) refuse(422, FULL);
        insertToken(tx, loaded.scene, token, point.x, point.y);
      },
      { status: 201 },
    ),
  );

  /** Puts every combatant not yet on the scene, in rows from (x, y). */
  routes.post('/encounter', (c) =>
    change(
      c,
      (tx, loaded, body) => {
        requireMaster(c);
        const point = parsePoint(body);
        const encounter = typeof body.encounterId === 'string'
          ? tx.select().from(encounters).where(and(eq(encounters.id, body.encounterId), eq(encounters.campaignId, c.var.campaignId))).get()
          : undefined;
        if (!encounter || encounter.status === 'ended') refuse(404, 'Encontro não encontrado.');

        const { scene } = loaded;
        const pending: NewToken[] = [];
        for (const combatant of tx.select().from(combatants).where(eq(combatants.encounterId, encounter.id)).all()) {
          if (combatant.characterId) {
            if (!onScene(tx, scene.id, tokens.characterId, combatant.characterId)) {
              pending.push({ kind: 'character', characterId: combatant.characterId, size: combatant.size });
            }
          } else if (!onScene(tx, scene.id, tokens.combatantId, combatant.id)) {
            pending.push({ kind: 'combatant', combatantId: combatant.id, size: combatant.size });
          }
        }
        if (pending.length === 0) refuse(409, 'Todos os combatentes deste encontro já estão na cena.');
        if (tokenCount(tx, scene.id) + pending.length > T.perScene) refuse(422, FULL);

        // A character's sheet decides its size, not the copy on the combatant.
        const sizes = new Map(
          tx.select({ id: characters.id, size: characters.size })
            .from(characters)
            .where(inArray(characters.id, pending.flatMap((token) => (token.characterId ? [token.characterId] : []))))
            .all()
            .map((row) => [row.id, row.size]),
        );
        const step = Math.max(...pending.map((token) => tokenDiameter(sizes.get(token.characterId ?? '') ?? token.size, scene.gridCellSize)));
        pending.forEach((token, index) => {
          const size = sizes.get(token.characterId ?? '') ?? token.size;
          const x = point.x + (index % ROW_LENGTH) * step;
          const y = point.y + Math.floor(index / ROW_LENGTH) * step;
          insertToken(tx, scene, { ...token, size }, x, y);
        });
      },
      { status: 201 },
    ),
  );

  routes.post('/:tokenId/grab', async (c) => {
    const { db, locks } = c.var.deps;
    try {
      const loaded = findScene(c, db);
      const token = findToken(c, loaded);
      requireMover(c, token);
      // A player off their turn cannot even pick the token up.
      const rule = moveRule(token.fighter, viewerOf(c), false);
      if (!rule.ok) refuse(rule.status, rule.error);
      const grabbed = locks.grab({
        campaignId: c.var.campaignId,
        sceneId: loaded.scene.id,
        tokenId: token.row.id,
        userId: c.var.user.id,
        userName: c.var.user.name,
        role: c.var.role,
        mapWidth: loaded.scene.mapWidth,
        mapHeight: loaded.scene.mapHeight,
      });
      if (!grabbed.ok) {
        const { holder } = grabbed;
        refuse(409, `${holder.userName} está movendo este token.`, { movingBy: { userId: holder.userId, name: holder.userName } });
      }
      // The table learns who is moving it.
      const updated = db.transaction((tx) => {
        bumpVersion(tx, loaded.scene.id);
        return loadScene(scopeOf(c), tx, loaded.scene.id)!;
      });
      publish(c, updated);
      return answer(c, updated);
    } catch (error) {
      return refused(c, error);
    }
  });

  routes.patch('/:tokenId', (c) => {
    const releases: (() => void)[] = [];
    let spentIn: string | null = null;
    return change(
      c,
      (tx, loaded, body) => {
        const token = findToken(c, loaded);
        const changes: Partial<TokenRow> = {};
        const moving = body.x !== undefined || body.y !== undefined;

        if (body.hidden !== undefined || body.label !== undefined) requireMaster(c);
        if (moving) {
          requireMover(c, token);
          requireNoOtherHolder(c, token.row.id);
          if (body.free !== undefined && typeof body.free !== 'boolean') refuse(422, 'Valor inválido para "sem gastar".');
          // In a fight the move is counted: on the combatant's turn, within what is left.
          const rule = moveRule(token.fighter, viewerOf(c), body.free === true);
          if (!rule.ok) refuse(rule.status, rule.error);
          const point = parsePoint(body);
          const rest = restingPoint(loaded.scene, token.size, point.x, point.y);
          if (rule.spends) {
            const refusedMove = spendMove(tx, rule.spends, token.row, rest, loaded.scene.gridCellSize);
            if (refusedMove) refuse(422, refusedMove);
            spentIn = rule.spends.encounterId;
          }
          Object.assign(changes, rest);
          releases.push(() => c.var.deps.locks.release(token.row.id, c.var.user.id));
        }
        if (body.hidden !== undefined) {
          if (typeof body.hidden !== 'boolean') refuse(422, 'Valor inválido para "escondido".');
          changes.hidden = body.hidden;
          // A player dragging it no longer sees it: the drag ends where the token is.
          if (body.hidden) {
            releases.push(() => {
              const holder = c.var.deps.locks.holder(token.row.id);
              if (holder && holder.role !== 'master') c.var.deps.locks.clear(token.row.id);
            });
          }
        }
        if (body.label !== undefined) {
          if (token.row.kind !== 'free') refuse(422, 'O nome deste token vem da ficha ou do combate.');
          const label = shortText(body.label, T.label);
          if (!label) refuse(422, `Dê um nome ao token, com até ${T.label} caracteres.`);
          changes.label = label;
        }
        if (Object.keys(changes).length === 0) refuse(422, 'Informe a posição, a visibilidade ou o nome do token.');
        tx.update(tokens).set(changes).where(eq(tokens.id, token.row.id)).run();
      },
      {
        after: () => {
          releases.forEach((release) => release());
          // The combat screens show what is left of the turn.
          if (spentIn) publishEncounter(c.var.deps, c.var.campaignId, spentIn);
        },
      },
    );
  });

  routes.delete('/:tokenId', (c) => {
    let removed: string | undefined;
    return change(
      c,
      (tx, loaded) => {
        const token = findToken(c, loaded);
        requireMaster(c);
        tx.delete(tokens).where(eq(tokens.id, token.row.id)).run();
        removed = token.row.id;
      },
      { after: () => removed && c.var.deps.locks.clear(removed) },
    );
  });

  return routes;
}
