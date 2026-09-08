import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { schema, type Db } from '@quest-fast/db';
import { criarApp } from './app.ts';
import type { ClienteDiscord, PerfilDiscord } from './auth/discord.ts';
import type { Env } from './env.ts';

const MIGRACOES = resolve(import.meta.dirname, '../../db/migrations');

/** Banco em memória com o schema real aplicado pelas migrações versionadas. */
export function criarDbDeTeste(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRACOES });
  return db;
}

export const envDeTeste: Env = {
  porta: 0,
  dbFile: ':memory:',
  clientDir: './nao-usado',
  discordClientId: 'id-de-teste',
  discordClientSecret: 'segredo-de-teste',
  discordRedirectUri: 'http://localhost/api/auth/discord/callback',
  cookieSeguro: false,
};

/**
 * Discord falso: o teste escolhe qual perfil o código devolve, sem rede e sem
 * credenciais. `códigoInvalido` simula a recusa do provedor.
 */
export function criarDiscordFalso(perfis: Record<string, PerfilDiscord>): ClienteDiscord {
  return {
    urlDeAutorizacao: (state) => `https://discord.test/authorize?state=${state}`,
    async trocarCodigoPorPerfil(codigo) {
      const perfil = perfis[codigo];
      if (!perfil) throw new (await import('./auth/discord.ts')).FalhaNoDiscord('código desconhecido');
      return perfil;
    },
  };
}

export type Mesa = ReturnType<typeof montarMesa>;

export function montarMesa(perfis: Record<string, PerfilDiscord>) {
  const db = criarDbDeTeste();
  const app = criarApp({ db, env: envDeTeste, discord: criarDiscordFalso(perfis), servirClient: false });
  return { db, app };
}

function cookieDaResposta(resposta: Response, nome: string): string | undefined {
  for (const bruto of resposta.headers.getSetCookie()) {
    const [par] = bruto.split(';');
    const [chave, valor] = par.split('=');
    if (chave === nome && valor) return valor;
  }
  return undefined;
}

/**
 * Percorre o fluxo real de OAuth — início, `state` e callback — e devolve o
 * cookie de sessão. Autenticar por atalho esconderia defeito no fluxo.
 */
export async function entrar(mesa: Mesa, codigo: string): Promise<string> {
  const inicio = await mesa.app.request('/api/auth/discord');
  const state = cookieDaResposta(inicio, 'qf_oauth_state');
  if (!state) throw new Error('fluxo de login não emitiu o cookie de state');

  const callback = await mesa.app.request(`/api/auth/discord/callback?code=${codigo}&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  const sessao = cookieDaResposta(callback, 'qf_sessao');
  if (!sessao) throw new Error(`login falhou para o código ${codigo}`);
  return sessao;
}

/** Requisição autenticada como o dono do cookie de sessão. */
export function comoUsuario(mesa: Mesa, sessao: string) {
  return (caminho: string, init: RequestInit = {}) =>
    mesa.app.request(caminho, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
        cookie: `qf_sessao=${sessao}`,
      },
    });
}

/** `Response.json()` devolve `unknown`; o teste declara o contrato esperado. */
export async function corpo<T>(resposta: Response): Promise<T> {
  return (await resposta.json()) as T;
}
