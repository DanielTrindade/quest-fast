import { randomUUID } from 'node:crypto';
import { and, count, eq, or } from 'drizzle-orm';
import { campaigns, characters, combatants, scenes, tokens } from '@quest-fast/db';
import { TOKEN_LIMITS, clampToMap, snapToCell, tokenDiameter, type Size } from '@quest-fast/shared';
import type { Executor } from '../combat/state.ts';
import { gridOf } from './store.ts';

/** Around the summoner, in this order: east, south, west, north, then the diagonals. */
const AROUND = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
] as const;

/**
 * A new summon appears on the open scene (#114), on a free cell beside its
 * summoner's token, so the player can act with it at once; the master may
 * move it afterwards. Nothing happens when the scene is not open, the
 * summoner has no token there, or the scene is full. Returns the scene to
 * publish, if any.
 */
export function placeBesideSummoner(
  tx: Executor,
  campaignId: string,
  summoner: { combatantId: string; characterId: string | null },
  summon: { combatantId: string; size: Size },
): string | null {
  const scene = tx
    .select({ scene: scenes })
    .from(campaigns)
    .innerJoin(scenes, eq(scenes.id, campaigns.activeSceneId))
    .where(eq(campaigns.id, campaignId))
    .get()?.scene;
  if (!scene) return null;
  const origin = summoner.characterId
    ? or(eq(tokens.combatantId, summoner.combatantId), eq(tokens.characterId, summoner.characterId))
    : eq(tokens.combatantId, summoner.combatantId);
  const beside = tx
    .select({ x: tokens.x, y: tokens.y, characterSize: characters.size, combatantSize: combatants.size })
    .from(tokens)
    .leftJoin(characters, eq(characters.id, tokens.characterId))
    .leftJoin(combatants, eq(combatants.id, tokens.combatantId))
    .where(and(eq(tokens.sceneId, scene.id), origin))
    .get();
  if (!beside) return null;
  const used = tx.select({ n: count() }).from(tokens).where(eq(tokens.sceneId, scene.id)).get()?.n ?? 0;
  if (used >= TOKEN_LIMITS.perScene) return null;

  const grid = gridOf(scene);
  const summonerSize = beside.characterSize ?? beside.combatantSize ?? 'medium';
  const step = (tokenDiameter(summonerSize, scene.gridCellSize) + tokenDiameter(summon.size, scene.gridCellSize)) / 2;
  const taken = tx.select({ x: tokens.x, y: tokens.y }).from(tokens).where(eq(tokens.sceneId, scene.id)).all();
  const rest = (x: number, y: number) => {
    const snapped = snapToCell(x, y, grid, summon.size);
    return clampToMap(snapped.x, snapped.y, scene.mapWidth, scene.mapHeight);
  };
  const candidates = AROUND.map(([dx, dy]) => rest(beside.x + dx * step, beside.y + dy * step));
  // Free: no token's centre within half a cell of it.
  const free = candidates.find((point) =>
    taken.every((token) => Math.hypot(token.x - point.x, token.y - point.y) >= scene.gridCellSize / 2),
  );
  tx.insert(tokens)
    .values({ id: randomUUID(), sceneId: scene.id, kind: 'combatant', combatantId: summon.combatantId, ...(free ?? candidates[0]) })
    .run();
  return scene.id;
}
