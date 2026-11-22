import { CHAT_LIMITS, chatLength } from '@quest-fast/shared';

/** One tap sends the emoji as a message. */
export const CHAT_REACTIONS = [
  { emoji: '😂', label: 'risada' },
  { emoji: '💀', label: 'caveira' },
  { emoji: '🎲', label: 'dado' },
  { emoji: '👀', label: 'olhos' },
  { emoji: '🔥', label: 'fogo' },
  { emoji: '🫡', label: 'continência' },
] as const;

/** A member the composer may mention: the account's name and the active character. */
export type ChatMember = { userId: string; name: string; characterName: string | null };

const fold = (text: string) => text.toLocaleLowerCase('pt-BR');

/**
 * The `@` being typed right before the caret, if any: where it starts and
 * what follows it. Names may have spaces, so the query runs to the caret, but
 * never across a line break and never longer than a Discord name.
 */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf('@');
  if (start < 0) return null;
  if (start > 0 && !/\s/.test(before[start - 1]!)) return null;
  const query = before.slice(start + 1);
  if (query.length > 32 || query.includes('\n')) return null;
  return { start, query };
}

/** Members whose name starts with the query, ignoring case; the shortest first. */
export function mentionCandidates(members: readonly ChatMember[], query: string, limit = 6): ChatMember[] {
  const wanted = fold(query);
  return members
    .filter((member) => fold(member.name).startsWith(wanted))
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit);
}

/** The text with the query replaced by `@Name `, and where the caret goes. */
export function insertMention(text: string, start: number, caret: number, name: string): { text: string; caret: number } {
  const mention = `@${name} `;
  const after = text.slice(caret).replace(/^ /, '');
  return { text: text.slice(0, start) + mention + after, caret: start + mention.length };
}

export type ChatCounter = { shown: boolean; tone: 'normal' | 'warn'; length: number; over: boolean };

/** The composer's counter: hidden until it matters, a warning near the end. */
export function chatCounter(text: string): ChatCounter {
  const length = chatLength(text.trim());
  return {
    shown: length >= CHAT_LIMITS.counterFrom,
    tone: length >= CHAT_LIMITS.warnFrom ? 'warn' : 'normal',
    length,
    over: length > CHAT_LIMITS.maxLength,
  };
}

/** What a screen reader hears for the unread count beside the Chat tab. */
export function unreadLabel(count: number, mention: boolean): string {
  const base = count === 1 ? '1 mensagem nova' : `${count} mensagens novas`;
  return mention ? `${base}, com menção a você` : base;
}
