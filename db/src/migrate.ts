import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { createDb } from './index.ts';

const db = createDb();
migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../migrations') });
console.log('Migrations applied.');
