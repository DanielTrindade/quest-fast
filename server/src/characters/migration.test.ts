import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';

const MIGRATIONS = resolve(import.meta.dirname, '../../../db/migrations');

function apply(sqlite: Database.Database, file: string) {
  const statements = readFileSync(resolve(MIGRATIONS, file), 'utf8').split('--> statement-breakpoint');
  for (const statement of statements) {
    if (statement.trim()) sqlite.exec(statement);
  }
}

test('a sheet stored before the official sheet opens rested and with the defaults', () => {
  const files = readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort();
  // 0000 and 0001 are the schema the pre-official sheets were written with.
  const [before, after] = [files.slice(0, 2), files.slice(2)];
  assert.ok(after.length > 0, 'the official sheet migration exists');

  const sqlite = new Database(':memory:');
  for (const file of before) apply(sqlite, file);

  sqlite.exec(`
    INSERT INTO users (id, discord_id, name) VALUES ('u1', '222', 'Rafael Costa');
    INSERT INTO campaigns (id, name, invite_code) VALUES ('c1', 'Ecos de Phandalin', 'ABC123');
    INSERT INTO characters (id, campaign_id, owner_id, name, race, class, level, ability_scores, hp, ac, skills, saves, attacks, features)
    VALUES ('k1', 'c1', 'u1', 'Kaelen', 'Elfo', 'Ladino', 3, '{}', 24, 15, '[]', '[]', '[]', '[]');
  `);

  for (const file of after) apply(sqlite, file);

  const row = sqlite.prepare('SELECT * FROM characters WHERE id = ?').get('k1') as Record<string, unknown>;
  assert.equal(row.hp_current, 24);
  assert.equal(row.hp_temp, 0);
  assert.equal(row.hit_die, 8);
  assert.equal(row.size, 'medium');
  assert.equal(row.speed, 9);
  assert.equal(row.subclass, '');
  assert.equal(row.spellcasting_ability, null);
  assert.equal(row.expertise, '[]');
  assert.deepEqual(JSON.parse(String(row.coins)), { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  assert.deepEqual(JSON.parse(String(row.death_saves)), { successes: 0, failures: 0 });
  sqlite.close();
});
