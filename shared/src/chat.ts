/**
 * The table chat: plain text among the members of a campaign, apart from the
 * game. Nothing here rolls, changes a sheet or reaches the feed.
 */

export const CHAT_LIMITS = {
  /** Characters (code points) of a message, after trimming. */
  maxLength: 300,
  /** From here the composer shows how many characters are left. */
  counterFrom: 240,
  /** From here the counter turns into a warning. */
  warnFrom: 290,
  /** Messages kept per campaign; older ones are deleted on insert. */
  retained: 500,
  /** Messages per page of the history. */
  pageSize: 50,
  /** Accepted messages per person and campaign within `rateWindowMs`. */
  rateLimit: 5,
  rateWindowMs: 5_000,
  /** Up to this many emoji, and nothing else, show large, like an emote. */
  emoteMax: 6,
} as const;

/** A stretch of the text that names a member: `@` included. */
export type ChatMention = { userId: string; start: number; end: number };

export type ChatAuthor = {
  userId: string;
  /** The account's name (Discord): the chat is out of character. */
  name: string;
  master: boolean;
  /** The member's active character in the campaign when read, for the token beside the name. */
  character: { name: string; avatarUrl: string | null } | null;
};

/** The message a reply quotes, as it is now: removed, it carries no text. */
export type ChatQuote = { id: string; authorName: string; body: string | null };

export type ChatMessageView = {
  id: string;
  campaignId: string;
  author: ChatAuthor;
  /** `null` once removed: the text is gone from the server too. */
  body: string | null;
  /**
   * Resolved by the server when the message was sent, against the members of
   * that moment. Renaming someone later does not move a highlight.
   */
  mentions: ChatMention[];
  /** `null` when not a reply, or when the quoted message fell out of the history. */
  replyTo: ChatQuote | null;
  removed: boolean;
  createdAt: string;
};

export type ChatPageResponse = { messages: ChatMessageView[]; nextCursor: string | null };
export type ChatMessageResponse = { message: ChatMessageView };
export type ChatSendRequest = { body: string; replyToId?: string };

/** Length as a person counts it: an accented letter or an emoji is one, not two. */
export function chatLength(text: string): number {
  return [...text].length;
}

/** What is stored: line breaks unified and the edges trimmed. */
export function normalizeChatBody(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

export function validateChatBody(value: unknown): { body: string } | { error: string } {
  if (typeof value !== 'string') return { error: 'Escreva uma mensagem.' };
  const body = normalizeChatBody(value);
  if (body.length === 0) return { error: 'Escreva uma mensagem.' };
  if (chatLength(body) > CHAT_LIMITS.maxLength) {
    return { error: `A mensagem passa de ${CHAT_LIMITS.maxLength} caracteres.` };
  }
  return { body };
}

const PICTOGRAPH = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u;

/** Only emoji, from one to `CHAT_LIMITS.emoteMax`, spaces aside: shown large. */
export function isEmote(text: string): boolean {
  const squeezed = text.replace(/\s+/g, '');
  if (squeezed.length === 0) return false;
  const graphemes = [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(squeezed)];
  return graphemes.length <= CHAT_LIMITS.emoteMax && graphemes.every(({ segment }) => PICTOGRAPH.test(segment));
}

const fold = (text: string) => text.toLocaleLowerCase('pt-BR');
/** A name ends where a word would not go on: "@Ana," names Ana, "@Anabela" does not. */
const WORD = /[\p{L}\p{N}\p{M}_]/u;

/**
 * Every `@Name` of the text that names a member, ignoring case. A member
 * whose name starts another's loses to the longer one ("@Ana Clara" is not
 * Ana); members with the same name are all mentioned.
 */
export function findMentions(body: string, members: readonly { userId: string; name: string }[]): ChatMention[] {
  const named = members
    .map((member) => ({ userId: member.userId, name: fold(member.name.trim()) }))
    .filter((member) => member.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const text = fold(body);
  // Lower-casing may change the length of a few letters; then offsets would
  // drift, so the original text is matched letter by letter instead.
  const sameLength = text.length === body.length;
  const mentions: ChatMention[] = [];

  for (let at = body.indexOf('@'); at !== -1; at = body.indexOf('@', at + 1)) {
    if (at > 0 && WORD.test(body[at - 1]!)) continue;
    const rest = sameLength ? text.slice(at + 1) : '';
    let longest = 0;
    for (const member of named) {
      if (longest > 0 && member.name.length < longest) break;
      const size = member.name.length;
      const candidate = sameLength ? rest.slice(0, size) : fold(body.slice(at + 1, at + 1 + size));
      if (candidate !== member.name) continue;
      const next = body[at + 1 + size];
      if (next !== undefined && WORD.test(next)) continue;
      longest = size;
      mentions.push({ userId: member.userId, start: at, end: at + 1 + size });
    }
    if (longest > 0) at += longest;
  }
  return mentions;
}

/** The text cut at its mentions, for highlighting them. */
export function chatSegments(body: string, mentions: readonly ChatMention[]): { text: string; mention: boolean }[] {
  const ranges = [...new Map(mentions.map(({ start, end }) => [`${start}:${end}`, { start, end }])).values()]
    .filter(({ start, end }) => start >= 0 && end <= body.length && start < end)
    .sort((a, b) => a.start - b.start);
  const segments: { text: string; mention: boolean }[] = [];
  let cursor = 0;
  for (const { start, end } of ranges) {
    if (start < cursor) continue;
    if (start > cursor) segments.push({ text: body.slice(cursor, start), mention: false });
    segments.push({ text: body.slice(start, end), mention: true });
    cursor = end;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor), mention: false });
  return segments;
}
