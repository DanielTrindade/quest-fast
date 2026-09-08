import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { criarDb } from './index.ts';

const db = criarDb();
migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../migrations') });
console.log('Migrações aplicadas.');
