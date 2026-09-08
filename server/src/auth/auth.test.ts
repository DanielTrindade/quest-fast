import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { users } from '@quest-fast/db';
import type { RespostaMe } from '@quest-fast/shared';
import { comoUsuario, corpo, entrar, montarMesa } from '../testing.ts';
import { montarAvatarUrl } from './discord.ts';

const LIA = { discordId: '111', nome: 'Lia Martins', avatarUrl: null };
const RAFAEL = { discordId: '222', nome: 'Rafael Costa', avatarUrl: null };

function mesa() {
  return montarMesa({ 'codigo-lia': LIA, 'codigo-rafael': RAFAEL });
}

test('primeiro acesso cria a conta e inicia a sessão', async () => {
  const m = mesa();
  const sessao = await entrar(m, 'codigo-lia');

  const resposta = await comoUsuario(m, sessao)('/api/auth/me');
  assert.equal(resposta.status, 200);
  assert.equal((await corpo<RespostaMe>(resposta)).usuario.nome, 'Lia Martins');
});

test('o callback redireciona para a listagem de campanhas', async () => {
  const m = mesa();
  const inicio = await m.app.request('/api/auth/discord');
  const state = inicio.headers.getSetCookie()[0].split(';')[0].split('=')[1];
  const callback = await m.app.request(`/api/auth/discord/callback?code=codigo-lia&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/campanhas');
});

test('acesso subsequente reconhece a conta e não duplica o usuário', async () => {
  const m = mesa();
  await entrar(m, 'codigo-lia');
  await entrar(m, 'codigo-lia');

  const contas = m.db.select().from(users).where(eq(users.discordId, '111')).all();
  assert.equal(contas.length, 1);
});

test('nome e avatar são atualizados a cada login', async () => {
  const m = montarMesa({ primeiro: LIA, segundo: { ...LIA, nome: 'Lia, a Bardo', avatarUrl: 'https://cdn/x.png' } });
  await entrar(m, 'primeiro');
  await entrar(m, 'segundo');

  const conta = m.db.select().from(users).where(eq(users.discordId, '111')).get();
  assert.equal(conta?.nome, 'Lia, a Bardo');
  assert.equal(conta?.avatarUrl, 'https://cdn/x.png');
});

test('autorização recusada no Discord não cria sessão', async () => {
  const m = mesa();
  const inicio = await m.app.request('/api/auth/discord');
  const state = inicio.headers.getSetCookie()[0].split(';')[0].split('=')[1];

  const callback = await m.app.request(`/api/auth/discord/callback?error=access_denied&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  assert.equal(callback.headers.get('location'), '/entrar?erro=discord');
  assert.equal(
    callback.headers.getSetCookie().some((c) => c.startsWith('qf_sessao=') && !c.startsWith('qf_sessao=;')),
    false,
  );
  assert.equal(m.db.select().from(users).all().length, 0);
});

test('callback com state divergente é recusado', async () => {
  const m = mesa();
  await m.app.request('/api/auth/discord');
  const callback = await m.app.request('/api/auth/discord/callback?code=codigo-lia&state=forjado', {
    headers: { cookie: 'qf_oauth_state=outro-valor' },
  });
  assert.equal(callback.headers.get('location'), '/entrar?erro=discord');
  assert.equal(m.db.select().from(users).all().length, 0);
});

test('callback sem o cookie de state é recusado', async () => {
  const m = mesa();
  const callback = await m.app.request('/api/auth/discord/callback?code=codigo-lia&state=qualquer');
  assert.equal(callback.headers.get('location'), '/entrar?erro=discord');
  assert.equal(m.db.select().from(users).all().length, 0);
});

test('rota de dados sem sessão responde 401 e não expõe nada', async () => {
  const m = mesa();
  for (const rota of ['/api/auth/me', '/api/campanhas']) {
    const resposta = await m.app.request(rota);
    assert.equal(resposta.status, 401, rota);
    assert.deepEqual(await resposta.json(), { erro: 'Não autenticado.' });
  }
});

test('sessão inválida é tratada como ausência de sessão', async () => {
  const m = mesa();
  const resposta = await comoUsuario(m, 'sessao-que-nao-existe')('/api/campanhas');
  assert.equal(resposta.status, 401);
});

test('logout invalida a sessão no servidor', async () => {
  const m = mesa();
  const sessao = await entrar(m, 'codigo-lia');
  const req = comoUsuario(m, sessao);

  assert.equal((await req('/api/auth/me')).status, 200);
  assert.equal((await req('/api/auth/logout', { method: 'POST' })).status, 204);
  // O mesmo cookie, reapresentado, já não vale: a sessão morreu no servidor.
  assert.equal((await req('/api/auth/me')).status, 401);
});

test('a sessão persiste entre requisições do mesmo navegador', async () => {
  const m = mesa();
  const sessao = await entrar(m, 'codigo-lia');
  const req = comoUsuario(m, sessao);
  for (let i = 0; i < 3; i++) assert.equal((await req('/api/auth/me')).status, 200);
});

test('o cookie de sessão é HttpOnly', async () => {
  const m = mesa();
  const inicio = await m.app.request('/api/auth/discord');
  const state = inicio.headers.getSetCookie()[0].split(';')[0].split('=')[1];
  const callback = await m.app.request(`/api/auth/discord/callback?code=codigo-lia&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  const cookie = callback.headers.getSetCookie().find((c) => c.startsWith('qf_sessao='));
  assert.match(cookie ?? '', /HttpOnly/i);
});

test('avatar do Discord vira URL, e ausência de hash vira nulo', () => {
  assert.equal(montarAvatarUrl('123', 'abc'), 'https://cdn.discordapp.com/avatars/123/abc.png');
  assert.equal(montarAvatarUrl('123', 'a_animado'), 'https://cdn.discordapp.com/avatars/123/a_animado.gif');
  assert.equal(montarAvatarUrl('123', null), null);
});
