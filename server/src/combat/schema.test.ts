import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';

const MIGRATIONS = resolve(import.meta.dirname, '../../../db/migrations');
const FILES = readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort();
// 0000 to 0002 are the schema before combat (phase 1 and the official sheet).
const BEFORE_COMBAT = 3;

function apply(sqlite: Database.Database, files: string[]) {
  for (const file of files) {
    const statements = readFileSync(resolve(MIGRATIONS, file), 'utf8').split('--> statement-breakpoint');
    for (const statement of statements) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
}

function migrated() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  apply(sqlite, FILES);
  sqlite.exec(`
    INSERT INTO users (id, discord_id, name) VALUES ('u1', '111', 'Lia Martins');
    INSERT INTO campaigns (id, name, invite_code) VALUES ('c1', 'Ecos de Phandalin', 'ABC123');
  `);
  return sqlite;
}

function insertEncounter(sqlite: Database.Database, id: string, status: string) {
  sqlite.prepare(`INSERT INTO encounters (id, campaign_id, name, status) VALUES (?, 'c1', ?, ?)`).run(id, id, status);
}

test('a sheet stored before combat starts with no conditions and no concentration', () => {
  assert.ok(FILES.length > BEFORE_COMBAT, 'the combat migration exists');
  const sqlite = new Database(':memory:');
  apply(sqlite, FILES.slice(0, BEFORE_COMBAT));
  sqlite.exec(`
    INSERT INTO users (id, discord_id, name) VALUES ('u1', '222', 'Rafael Costa');
    INSERT INTO campaigns (id, name, invite_code) VALUES ('c1', 'Ecos de Phandalin', 'ABC123');
    INSERT INTO characters (id, campaign_id, owner_id, name, race, class, level, ability_scores, hp, ac, skills, saves, attacks, features)
    VALUES ('k1', 'c1', 'u1', 'Kaelen', 'Elfo', 'Ladino', 3, '{}', 24, 15, '[]', '[]', '[]', '[]');
  `);

  apply(sqlite, FILES.slice(BEFORE_COMBAT));

  const row = sqlite.prepare('SELECT conditions, concentrating FROM characters WHERE id = ?').get('k1') as Record<
    string,
    unknown
  >;
  assert.equal(row.conditions, '[]');
  assert.equal(row.concentrating, 0);
  sqlite.close();
});

test('a campaign holds at most one active encounter, and any number in preparation', () => {
  const sqlite = migrated();
  insertEncounter(sqlite, 'e1', 'preparing');
  insertEncounter(sqlite, 'e2', 'preparing');
  insertEncounter(sqlite, 'e3', 'active');
  insertEncounter(sqlite, 'e4', 'ended');
  insertEncounter(sqlite, 'e5', 'ended');
  assert.throws(() => insertEncounter(sqlite, 'e6', 'active'), /UNIQUE/);
  sqlite.close();
});

test('a new encounter starts in preparation at round 0, with version 0', () => {
  const sqlite = migrated();
  sqlite.exec(`INSERT INTO encounters (id, campaign_id, name) VALUES ('e1', 'c1', 'Emboscada')`);
  const row = sqlite.prepare('SELECT status, round, version, active_combatant_id FROM encounters').get();
  assert.deepEqual(row, { status: 'preparing', round: 0, version: 0, active_combatant_id: null });
  sqlite.close();
});

test('deleting a statblock keeps the combatants that came from it', () => {
  const sqlite = migrated();
  sqlite.exec(`
    INSERT INTO statblocks (id, campaign_id, name, ac, hp_average, ability_scores, attacks)
    VALUES ('s1', 'c1', 'Goblin', 15, 7, '{}', '[]');
    INSERT INTO encounters (id, campaign_id, name) VALUES ('e1', 'c1', 'Emboscada');
    INSERT INTO combatants (id, encounter_id, source, statblock_id, name, ac, hp_max, hp_current)
    VALUES ('m1', 'e1', 'statblock', 's1', 'Goblin', 15, 7, 7);
    DELETE FROM statblocks WHERE id = 's1';
  `);
  const row = sqlite.prepare('SELECT name, statblock_id FROM combatants WHERE id = ?').get('m1');
  assert.deepEqual(row, { name: 'Goblin', statblock_id: null });
  sqlite.close();
});

test('deleting a character or an encounter removes its combatants', () => {
  const sqlite = migrated();
  sqlite.exec(`
    INSERT INTO characters (id, campaign_id, owner_id, name, race, class, level, ability_scores, hp, ac, skills, saves, attacks, features)
    VALUES ('k1', 'c1', 'u1', 'Kaelen', 'Elfo', 'Ladino', 3, '{}', 24, 15, '[]', '[]', '[]', '[]');
    INSERT INTO encounters (id, campaign_id, name) VALUES ('e1', 'c1', 'Emboscada'), ('e2', 'c1', 'Ponte');
    INSERT INTO combatants (id, encounter_id, source, character_id, name) VALUES ('p1', 'e1', 'character', 'k1', 'Kaelen');
    INSERT INTO combatants (id, encounter_id, source, name, ac, hp_max, hp_current) VALUES ('m1', 'e2', 'manual', 'Troll', 15, 84, 84);
    DELETE FROM characters WHERE id = 'k1';
    DELETE FROM encounters WHERE id = 'e2';
  `);
  const count = sqlite.prepare('SELECT count(*) AS n FROM combatants').get() as { n: number };
  assert.equal(count.n, 0);
  sqlite.close();
});

test('deleting a campaign removes its bestiary and encounters', () => {
  const sqlite = migrated();
  sqlite.exec(`
    INSERT INTO statblocks (id, campaign_id, name, ac, hp_average, ability_scores, attacks)
    VALUES ('s1', 'c1', 'Goblin', 15, 7, '{}', '[]');
    INSERT INTO encounters (id, campaign_id, name) VALUES ('e1', 'c1', 'Emboscada');
    DELETE FROM campaigns WHERE id = 'c1';
  `);
  for (const table of ['statblocks', 'encounters']) {
    const count = sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number };
    assert.equal(count.n, 0, table);
  }
  sqlite.close();
});
