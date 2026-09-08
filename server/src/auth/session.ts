import { randomUUID } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { sessions, users, type Db, type UserRow } from '@quest-fast/db';
import type { DiscordProfile } from './discord.ts';

export const SESSION_COOKIE = 'qf_session';
export const STATE_COOKIE = 'qf_oauth_state';

/** Thirty days: a table usually plays every couple of weeks. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Creates the user on first access and refreshes name and avatar on later
 * ones. `discordId` is the stable identity; name and avatar change on Discord.
 */
export function upsertDiscordUser(db: Db, profile: DiscordProfile): UserRow {
  const existing = db.select().from(users).where(eq(users.discordId, profile.discordId)).get();
  const now = new Date();

  if (existing) {
    return db
      .update(users)
      .set({ name: profile.name, avatarUrl: profile.avatarUrl, updatedAt: now })
      .where(eq(users.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(users)
    .values({
      id: randomUUID(),
      discordId: profile.discordId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function createSession(db: Db, userId: string, now = new Date()): { id: string; expiresAt: Date } {
  const id = randomUUID();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  db.insert(sessions).values({ id, userId, createdAt: now, expiresAt }).run();
  return { id, expiresAt };
}

/** Returns the session's user, or `undefined` if it does not exist or expired. */
export function sessionUser(db: Db, sessionId: string, now = new Date()): UserRow | undefined {
  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get();
  return row?.user;
}

/** Logout invalidates on the server; dropping the cookie alone ends nothing. */
export function destroySession(db: Db, sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function deleteExpiredSessions(db: Db, now = new Date()): void {
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}
