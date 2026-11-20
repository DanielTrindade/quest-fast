import { findMentions, type ChatAuthor, type ChatMessageView } from '@quest-fast/shared';
import type { ChatMember } from '../../lib/chat-compose';

export const VIEWER_ID = 'u-rafael';

export const AUTHORS = {
  lia: { userId: 'u-lia', name: 'Lia Martins', master: true, character: null },
  rafael: { userId: VIEWER_ID, name: 'Rafael', master: false, character: { name: 'Hazin Dan', avatarUrl: null } },
  bruna: { userId: 'u-bruna', name: 'Bruna', master: false, character: { name: 'Lyra Vesper', avatarUrl: null } },
  caio: { userId: 'u-caio', name: 'Caio', master: false, character: { name: 'Thorin', avatarUrl: null } },
  long: { userId: 'u-long', name: 'xX_DestruidorDeMundos_1234567_Xx', master: false, character: { name: 'Grimbold Pedra-Funda da Montanha Cinzenta', avatarUrl: null } },
} satisfies Record<string, ChatAuthor>;

export const CHAT_MEMBERS: ChatMember[] = Object.values(AUTHORS)
  .filter(({ userId }) => userId !== VIEWER_ID)
  .map(({ userId, name, character }) => ({ userId, name, characterName: character?.name ?? null }))
  // A name that starts another's: picking the shorter one must close the list.
  .concat({ userId: 'u-bruna-clara', name: 'Bruna Clara', characterName: null });

const ALL_MEMBERS = Object.values(AUTHORS).map(({ userId, name }) => ({ userId, name }));

let clock = Date.UTC(2026, 10, 20, 22, 0);

/** A message as the server sends it, mentions resolved against the members. */
export function chatMessage(author: ChatAuthor, body: string, extra: Partial<ChatMessageView> = {}): ChatMessageView {
  clock += 37_000;
  return {
    id: extra.id ?? `m-${clock}`,
    campaignId: 'phandalin',
    author,
    body,
    mentions: findMentions(body, ALL_MEMBERS),
    replyTo: null,
    removed: false,
    createdAt: new Date(clock).toISOString(),
    ...extra,
  };
}

const opening = chatMessage(AUTHORS.lia, 'Boa noite, mesa! Começamos em 5 min, peguem água 🎲');
const nat1 = chatMessage(AUTHORS.caio, 'tirei 1 natural no teste de Atletismo kkkkk');

export const conversation: ChatMessageView[] = [
  opening,
  chatMessage(AUTHORS.bruna, 'cheguei'),
  chatMessage(AUTHORS.rafael, 'chegueeei, só pegando o fone'),
  nat1,
  chatMessage(AUTHORS.bruna, '💀💀💀'),
  chatMessage(AUTHORS.rafael, 'o Thorin escorregando na pedra de novo', {
    replyTo: { id: nat1.id, authorName: nat1.author.name, body: nat1.body },
  }),
  chatMessage(AUTHORS.lia, '@Rafael a porta tá trancada, quer tentar Ladinagem?'),
  chatMessage(AUTHORS.caio, 'mensagem que ninguém deveria ver', { body: null, mentions: [], removed: true }),
  chatMessage(AUTHORS.bruna, '@Caio vc não tinha uma pé de cabra?\nacho que comprou em Phandalin'),
  chatMessage(AUTHORS.rafael, '🫡'),
];

/** Many lines, to scroll. */
export function longConversation(total: number): ChatMessageView[] {
  const people = [AUTHORS.lia, AUTHORS.bruna, AUTHORS.caio, AUTHORS.rafael];
  return Array.from({ length: total }, (_, index) =>
    chatMessage(people[index % people.length]!, index % 7 === 3 ? '😂' : `mensagem ${index + 1} da noite, comentando a cena`, { id: `long-${index}` }));
}

/** The worst case of names: 32 characters with no space, a long character, a reply to them. */
export const worstNames: ChatMessageView[] = (() => {
  const first = chatMessage(AUTHORS.long, `${'a'.repeat(60)} @Bruna ${'texto-sem-espaço-'.repeat(8)}`);
  return [
    first,
    chatMessage(AUTHORS.bruna, '@xX_DestruidorDeMundos_1234567_Xx para de spammar 😂', {
      replyTo: { id: first.id, authorName: first.author.name, body: first.body },
    }),
    chatMessage(AUTHORS.long, 'x'.repeat(300)),
  ];
})();
