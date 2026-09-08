import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

export * from './schema.ts';
export { schema };

export type Db = ReturnType<typeof criarDb>;

/** Caminho padrão do arquivo; `DB_FILE` sobrescreve no self-host. */
export const CAMINHO_DB_PADRAO = 'quest-fast.db';

export function criarDb(caminho = process.env.DB_FILE ?? CAMINHO_DB_PADRAO) {
  const sqlite = new Database(caminho);
  // WAL melhora leituras concorrentes; as chaves estrangeiras do schema só
  // são aplicadas pelo SQLite quando ligadas explicitamente por conexão.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
