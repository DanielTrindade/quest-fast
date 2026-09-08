import { randomUUID } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { sessions, users, type Db, type User } from '@quest-fast/db';
import type { PerfilDiscord } from './discord.ts';

export const COOKIE_SESSAO = 'qf_sessao';
export const COOKIE_STATE = 'qf_oauth_state';

/** Trinta dias: uma mesa costuma jogar quinzenalmente. */
export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cria o usuário no primeiro acesso e atualiza nome e avatar nos seguintes.
 * O `discordId` é a identidade estável; nome e avatar mudam no Discord.
 */
export function upsertUsuarioDoDiscord(db: Db, perfil: PerfilDiscord): User {
  const existente = db.select().from(users).where(eq(users.discordId, perfil.discordId)).get();
  const agora = new Date();

  if (existente) {
    return db
      .update(users)
      .set({ nome: perfil.nome, avatarUrl: perfil.avatarUrl, atualizadoEm: agora })
      .where(eq(users.id, existente.id))
      .returning()
      .get();
  }

  return db
    .insert(users)
    .values({
      id: randomUUID(),
      discordId: perfil.discordId,
      nome: perfil.nome,
      avatarUrl: perfil.avatarUrl,
      criadoEm: agora,
      atualizadoEm: agora,
    })
    .returning()
    .get();
}

export function criarSessao(db: Db, userId: string, agora = new Date()): { id: string; expiraEm: Date } {
  const id = randomUUID();
  const expiraEm = new Date(agora.getTime() + DURACAO_SESSAO_MS);
  db.insert(sessions).values({ id, userId, criadaEm: agora, expiraEm }).run();
  return { id, expiraEm };
}

/** Devolve o usuário da sessão, ou `undefined` se ela não existe ou expirou. */
export function usuarioDaSessao(db: Db, sessaoId: string, agora = new Date()): User | undefined {
  const linha = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessaoId), gt(sessions.expiraEm, agora)))
    .get();
  return linha?.user;
}

/** Logout invalida no servidor; apagar o cookie sozinho não encerraria nada. */
export function destruirSessao(db: Db, sessaoId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessaoId)).run();
}

export function limparSessoesExpiradas(db: Db, agora = new Date()): void {
  db.delete(sessions).where(lt(sessions.expiraEm, agora)).run();
}
