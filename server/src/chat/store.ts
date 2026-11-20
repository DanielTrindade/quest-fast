import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { assets, campaignMembers, characters, chatMessages, users, type Db } from '@quest-fast/db';
import { CHAT_LIMITS, findMentions, type ChatMessageView, type ChatPageResponse } from '@quest-fast/shared';
import type { AssetStore } from '../assets/store.ts';

const quoted = alias(chatMessages, 'quoted');
const quotedAuthors = alias(users, 'quoted_authors');

/**
 * Messages as the whole table reads them, newest first. The author's badge and
 * token are the ones of now: the role in the campaign and the active
 * character. A removed message (or quote) never carries its text.
 */
function readViews(db: Pick<Db, 'select'>, store: AssetStore, campaignId: string, where: SQL[], limit: number): ChatMessageView[] {
  const rows = db
    .select({
      message: chatMessages,
      authorName: users.name,
      role: campaignMembers.role,
      characterName: characters.name,
      avatarPath: assets.path,
      quotedId: quoted.id,
      quotedBody: quoted.body,
      quotedRemoved: quoted.removedAt,
      quotedAuthor: quotedAuthors.name,
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.userId))
    .leftJoin(campaignMembers, and(eq(campaignMembers.campaignId, chatMessages.campaignId), eq(campaignMembers.userId, chatMessages.userId)))
    .leftJoin(characters, and(
      eq(characters.campaignId, chatMessages.campaignId),
      eq(characters.ownerId, chatMessages.userId),
      eq(characters.active, true),
    ))
    .leftJoin(assets, eq(assets.id, characters.avatarAssetId))
    .leftJoin(quoted, eq(quoted.id, chatMessages.replyToId))
    .leftJoin(quotedAuthors, eq(quotedAuthors.id, quoted.userId))
    .where(and(eq(chatMessages.campaignId, campaignId), ...where))
    .orderBy(desc(chatMessages.createdAt), sql`${chatMessages}.rowid desc`)
    .limit(limit)
    .all();

  return rows.map((row) => {
    const removed = row.message.removedAt !== null;
    return {
      id: row.message.id,
      campaignId: row.message.campaignId,
      author: {
        userId: row.message.userId,
        name: row.authorName,
        master: row.role === 'master',
        character: row.characterName === null
          ? null
          : { name: row.characterName, avatarUrl: row.avatarPath ? store.urlFor(row.avatarPath) : null },
      },
      body: removed ? null : row.message.body,
      mentions: removed ? [] : row.message.mentions,
      replyTo: row.quotedId === null
        ? null
        : { id: row.quotedId, authorName: row.quotedAuthor ?? '', body: row.quotedRemoved === null ? row.quotedBody : null },
      removed,
      createdAt: row.message.createdAt.toISOString(),
    };
  });
}

/** Where a message sits in the history: the cursor of a page. */
function position(db: Pick<Db, 'select'>, campaignId: string, id: string) {
  return db
    .select({
      // The raw column value, so the SQL template binds a number, not a Date.
      createdAt: sql<number>`${chatMessages.createdAt}`,
      rowid: sql<number>`${chatMessages}.rowid`,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, id), eq(chatMessages.campaignId, campaignId)))
    .get();
}

/**
 * A page of the history, oldest first. `cursor` is the id of the oldest
 * message already shown; the page ends right before it. Messages share a
 * second at the table, so `rowid` keeps the insertion order within it.
 */
export function readChat(db: Db, store: AssetStore, campaignId: string, cursor?: string): ChatPageResponse {
  const where: SQL[] = [];
  if (cursor) {
    const at = position(db, campaignId, cursor);
    // The cursor fell out of the history: nothing older is left either.
    if (!at) return { messages: [], nextCursor: null };
    where.push(sql`(${chatMessages.createdAt} < ${at.createdAt} OR (${chatMessages.createdAt} = ${at.createdAt} AND ${chatMessages}.rowid < ${at.rowid}))`);
  }
  // One extra row tells whether anything older exists.
  const views = readViews(db, store, campaignId, where, CHAT_LIMITS.pageSize + 1);
  const hasOlder = views.length > CHAT_LIMITS.pageSize;
  const messages = views.slice(0, CHAT_LIMITS.pageSize).reverse();
  return { messages, nextCursor: hasOlder ? messages[0]!.id : null };
}

export function readMessage(db: Pick<Db, 'select'>, store: AssetStore, campaignId: string, id: string): ChatMessageView | null {
  return readViews(db, store, campaignId, [eq(chatMessages.id, id)], 1)[0] ?? null;
}

export type SendOutcome = { message: ChatMessageView } | { error: string };

/**
 * Saves a message and, in the same transaction, deletes the campaign's oldest
 * ones past `CHAT_LIMITS.retained`. Mentions are resolved here, against the
 * members of this moment.
 */
export function sendMessage(
  db: Db,
  store: AssetStore,
  input: { campaignId: string; userId: string; body: string; replyToId?: string },
): SendOutcome {
  return db.transaction((tx) => {
    if (input.replyToId !== undefined) {
      const original = tx
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(and(eq(chatMessages.id, input.replyToId), eq(chatMessages.campaignId, input.campaignId)))
        .get();
      if (!original) return { error: 'A mensagem respondida não existe mais.' };
    }

    const members = tx
      .select({ userId: campaignMembers.userId, name: users.name })
      .from(campaignMembers)
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(eq(campaignMembers.campaignId, input.campaignId))
      .all();

    const id = randomUUID();
    tx.insert(chatMessages)
      .values({
        id,
        campaignId: input.campaignId,
        userId: input.userId,
        body: input.body,
        mentions: findMentions(input.body, members),
        replyToId: input.replyToId ?? null,
      })
      .run();

    tx.run(sql`
      DELETE FROM ${chatMessages}
      WHERE ${chatMessages.campaignId} = ${input.campaignId}
        AND rowid NOT IN (
          SELECT rowid FROM ${chatMessages}
          WHERE ${chatMessages.campaignId} = ${input.campaignId}
          ORDER BY ${chatMessages.createdAt} DESC, rowid DESC
          LIMIT ${CHAT_LIMITS.retained}
        )`);

    return { message: readMessage(tx, store, input.campaignId, id)! };
  });
}

export type RemoveOutcome = 'removed' | 'not-found' | 'forbidden';

/** The author or the master removes a message; its text is wiped, not hidden. */
export function removeMessage(
  db: Db,
  input: { campaignId: string; messageId: string; userId: string; master: boolean },
): RemoveOutcome {
  return db.transaction((tx) => {
    const row = tx
      .select({ userId: chatMessages.userId, removedAt: chatMessages.removedAt })
      .from(chatMessages)
      .where(and(eq(chatMessages.id, input.messageId), eq(chatMessages.campaignId, input.campaignId)))
      .get();
    if (!row) return 'not-found';
    if (row.userId !== input.userId && !input.master) return 'forbidden';
    if (row.removedAt === null) {
      tx.update(chatMessages)
        .set({ body: '', mentions: [], removedAt: new Date(), removedBy: input.userId })
        .where(eq(chatMessages.id, input.messageId))
        .run();
    }
    return 'removed';
  });
}
