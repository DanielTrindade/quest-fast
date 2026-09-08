import { randomUUID } from 'node:crypto';
import { gerarCodigoConvite } from '@quest-fast/shared';
import { campaignMembers, campaigns, criarDb, sessions, users } from './index.ts';

/**
 * Campanha de exemplo para desenvolvimento e revisão visual. Cria também uma
 * sessão fixa, de modo que a interface possa ser aberta sem passar pelo
 * Discord. Não deve ser executado em produção.
 *
 *   npm run db:seed
 *
 * A sessão impressa ao final vale como cookie `qf_sessao`.
 */

const db = criarDb();

const mestre = { id: randomUUID(), discordId: 'seed-mestre', nome: 'Lia Martins', avatarUrl: null };
const jogadores = [
  { id: randomUUID(), discordId: 'seed-rafael', nome: 'Rafael Costa', avatarUrl: null },
  { id: randomUUID(), discordId: 'seed-ana', nome: 'Ana Beatriz', avatarUrl: null },
  { id: randomUUID(), discordId: 'seed-pedro', nome: 'Pedro Alves', avatarUrl: null },
];

for (const usuario of [mestre, ...jogadores]) {
  db.insert(users).values(usuario).onConflictDoNothing().run();
}

const campanha = {
  id: randomUUID(),
  nome: 'Ecos de Phandalin',
  descricao: 'A próxima aventura começa com a mesa reunida.',
  codigoConvite: gerarCodigoConvite(),
};
db.insert(campaigns).values(campanha).run();

db.insert(campaignMembers)
  .values({ id: randomUUID(), campaignId: campanha.id, userId: mestre.id, papel: 'mestre' })
  .run();
for (const jogador of jogadores) {
  db.insert(campaignMembers)
    .values({ id: randomUUID(), campaignId: campanha.id, userId: jogador.id, papel: 'jogador' })
    .run();
}

const sessao = randomUUID();
db.insert(sessions)
  .values({
    id: sessao,
    userId: mestre.id,
    expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  .run();

console.log(`Campanha "${campanha.nome}" criada com o código ${campanha.codigoConvite}.`);
console.log(`Sessão do mestre (cookie qf_sessao): ${sessao}`);
