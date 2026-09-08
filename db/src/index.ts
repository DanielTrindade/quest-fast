import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

export * from './schema.ts';
export { schema };

export type Db = ReturnType<typeof createDb>;

/** Default file path; `DB_FILE` overrides it when self-hosting. */
export const DEFAULT_DB_PATH = 'quest-fast.db';

export function createDb(path = process.env.DB_FILE ?? DEFAULT_DB_PATH) {
  const sqlite = new Database(path);
  // WAL improves concurrent reads; the schema's foreign keys are only
  // enforced by SQLite when turned on explicitly, per connection.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
