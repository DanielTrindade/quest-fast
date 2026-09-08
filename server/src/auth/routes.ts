import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Contexto } from '../contexto.ts';
import { FalhaNoDiscord } from './discord.ts';
import {
  COOKIE_SESSAO,
  COOKIE_STATE,
  DURACAO_SESSAO_MS,
  criarSessao,
  destruirSessao,
  upsertUsuarioDoDiscord,
} from './session.ts';

/** Para onde o navegador volta depois do Discord. */
const DESTINO_APOS_LOGIN = '/campanhas';
const DESTINO_APOS_FALHA = '/entrar?erro=discord';

export function rotasDeAuth() {
  const rotas = new Hono<Contexto>();

  rotas.get('/discord', (c) => {
    const { discord, env } = c.var.deps;
    // `state` amarra o callback a este navegador e barra CSRF de login.
    const state = randomUUID();
    setCookie(c, COOKIE_STATE, state, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.cookieSeguro,
      maxAge: 600,
    });
    return c.redirect(discord.urlDeAutorizacao(state));
  });

  rotas.get('/discord/callback', async (c) => {
    const { db, discord, env } = c.var.deps;
    const stateEsperado = getCookie(c, COOKIE_STATE);
    deleteCookie(c, COOKIE_STATE, { path: '/' });

    const codigo = c.req.query('code');
    const state = c.req.query('state');

    // O Discord devolve `error=access_denied` quando o usuário recusa.
    if (c.req.query('error') || !codigo) return c.redirect(DESTINO_APOS_FALHA);
    if (!state || !stateEsperado || state !== stateEsperado) return c.redirect(DESTINO_APOS_FALHA);

    let perfil;
    try {
      perfil = await discord.trocarCodigoPorPerfil(codigo);
    } catch (erro) {
      if (erro instanceof FalhaNoDiscord) return c.redirect(DESTINO_APOS_FALHA);
      throw erro;
    }

    const usuario = upsertUsuarioDoDiscord(db, perfil);
    const sessao = criarSessao(db, usuario.id);
    setCookie(c, COOKIE_SESSAO, sessao.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.cookieSeguro,
      maxAge: DURACAO_SESSAO_MS / 1000,
    });
    return c.redirect(DESTINO_APOS_LOGIN);
  });

  rotas.post('/logout', (c) => {
    const { db } = c.var.deps;
    const sessaoId = getCookie(c, COOKIE_SESSAO);
    if (sessaoId) destruirSessao(db, sessaoId);
    deleteCookie(c, COOKIE_SESSAO, { path: '/' });
    return c.body(null, 204);
  });

  return rotas;
}
