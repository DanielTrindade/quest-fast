import { randomUUID } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { sessionEvents, users, type Db } from '@quest-fast/db';
import type { RollPayload, SessionEvent } from '@quest-fast/shared';

/**
 * Persisting a roll event. `userName` is baked in so the feed stays readable
 * even if a member is later removed from the campaign.
 */
export function recordRollEvent(
  db: Db,
  input: {
    campaignId: string;
    userId: string;
    userName: string;
    secret: boolean;
    payload: RollPayload;
  },
): SessionEvent {
  const row = db
    .insert(sessionEvents)
    .values({
      id: randomUUID(),
      campaignId: input.campaignId,
      userId: input.userId,
      type: 'roll',
      secret: input.secret,
      payload: input.payload,
    })
    .returning()
    .get();

  return {
    id: row.id,
    campaignId: row.campaignId,
    userId: row.userId,
    userName: input.userName,
    type: row.type as SessionEvent['type'],
    secret: row.secret,
    payload: row.payload as RollPayload,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Latest events, oldest first, ready for the client. */
export function readFeed(db: Db, campaignId: string, role: 'master' | 'player', limit = 50): SessionEvent[] {
  const rows = db
    .select({ event: sessionEvents, userName: users.name })
    .from(sessionEvents)
    .innerJoin(users, eq(users.id, sessionEvents.userId))
    .where(eq(sessionEvents.campaignId, campaignId))
    // Created timestamps share a second at the table; `rowid` keeps insertion
    // order stable within it, so the newest limit is not a random pick.
    .orderBy(desc(sessionEvents.createdAt), sql`${sessionEvents}.rowid desc`)
    .limit(limit)
    .all()
    .reverse();

  return rows
    .filter(({ event }) => !event.secret || role === 'master')
    .map(({ event, userName }) => ({
      id: event.id,
      campaignId: event.campaignId,
      userId: event.userId,
      userName,
      type: event.type as SessionEvent['type'],
      secret: event.secret,
      payload: event.payload as RollPayload,
      createdAt: event.createdAt.toISOString(),
    }));
}