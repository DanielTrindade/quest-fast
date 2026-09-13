import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { sessionEvents, users, type Db } from '@quest-fast/db';
import type { RollPayload, RollSessionEvent } from '@quest-fast/shared';

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
): RollSessionEvent {
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
    type: row.type as RollSessionEvent['type'],
    secret: row.secret,
    payload: row.payload as RollPayload,
    createdAt: row.createdAt.toISOString(),
  };
}

export type FeedPage = { events: RollSessionEvent[]; nextCursor: string | null };

/**
 * Latest events, oldest first, ready for the client. `before` is an opaque
 * cursor (an event id): the page starts right before that event. Secret
 * events are filtered in SQL so the limit counts only what the reader may
 * see, keeping `nextCursor` honest for players.
 */
export function readFeed(
  db: Db,
  campaignId: string,
  role: 'master' | 'player',
  options: { limit?: number; before?: string } = {},
): FeedPage {
  const limit = options.limit ?? 50;
  const conditions = [eq(sessionEvents.campaignId, campaignId)];
  if (role !== 'master') conditions.push(eq(sessionEvents.secret, false));

  if (options.before) {
    const cursor = db
      .select({
        // The raw column value, so the SQL template binds a number, not a Date.
        createdAt: sql<number>`${sessionEvents.createdAt}`,
        rowid: sql<number>`${sessionEvents}.rowid`,
      })
      .from(sessionEvents)
      .where(and(eq(sessionEvents.id, options.before), eq(sessionEvents.campaignId, campaignId)))
      .get();
    if (!cursor) return { events: [], nextCursor: null };
    // Timestamps share a second at the table; `rowid` keeps insertion order
    // stable within it, so "before" is well-defined even on ties.
    conditions.push(
      sql`(${sessionEvents.createdAt} < ${cursor.createdAt} OR (${sessionEvents.createdAt} = ${cursor.createdAt} AND ${sessionEvents}.rowid < ${cursor.rowid}))`,
    );
  }

  const rows = db
    .select({ event: sessionEvents, userName: users.name })
    .from(sessionEvents)
    .innerJoin(users, eq(users.id, sessionEvents.userId))
    .where(and(...conditions))
    .orderBy(desc(sessionEvents.createdAt), sql`${sessionEvents}.rowid desc`)
    // One extra row tells whether anything older exists, so a history that
    // ends exactly on a page boundary does not offer an empty "load more".
    .limit(limit + 1)
    .all();
  const hasOlder = rows.length > limit;
  const page = rows.slice(0, limit).reverse();

  const events = page.map(({ event, userName }) => ({
    id: event.id,
    campaignId: event.campaignId,
    userId: event.userId,
    userName,
    type: event.type as RollSessionEvent['type'],
    secret: event.secret,
    payload: event.payload as RollPayload,
    createdAt: event.createdAt.toISOString(),
  }));

  // The oldest id on the page is the cursor for the next "load more".
  const nextCursor = hasOlder ? (events[0]!.id as string) : null;
  return { events, nextCursor };
}