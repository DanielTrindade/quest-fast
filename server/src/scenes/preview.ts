import { and, eq } from 'drizzle-orm';
import { campaigns, scenes, users, type Db } from '@quest-fast/db';
import { isAreaVisible } from '@quest-fast/shared';
import type { Viewer } from '../events/hub.ts';
import { fogOf } from './projection.ts';

/**
 * Who may watch a reference area the sender draws on a scene (#113), and
 * what relaying it needs. Only the scene open for the table: a reference
 * area is for the table to see, and a player knows no other scene. The
 * master's area hides under the fog like a monster; a player's shows to all.
 * Read on every message, so the fog or closing the map take effect at once.
 * Null when the scene is not the open one of this campaign.
 */
export function previewAudience(db: Db, sender: Viewer & { campaignId: string }, sceneId: string, at: { x: number; y: number }) {
  const row = db
    .select({
      mapWidth: scenes.mapWidth,
      mapHeight: scenes.mapHeight,
      fogEnabled: scenes.fogEnabled,
      fogRevealed: scenes.fogRevealed,
    })
    .from(scenes)
    .innerJoin(campaigns, and(eq(campaigns.id, scenes.campaignId), eq(campaigns.activeSceneId, scenes.id)))
    .where(and(eq(scenes.id, sceneId), eq(scenes.campaignId, sender.campaignId)))
    .get();
  if (!row) return null;
  const name = db.select({ name: users.name }).from(users).where(eq(users.id, sender.userId)).get()?.name ?? '';
  const fog = fogOf(row);
  const visibility = { hidden: false, byMaster: sender.role === 'master', anchor: null, ...at };
  return {
    name,
    map: { width: row.mapWidth, height: row.mapHeight },
    canSee: (viewer: Viewer) => isAreaVisible(visibility, viewer.role, fog),
  };
}
