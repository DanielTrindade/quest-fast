import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';

const MIGRATIONS = resolve(import.meta.dirname, '../../../db/migrations');
const FILES = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

function apply(sqlite: Database.Database, migrations: string[]) {
  for (const migration of migrations) {
    const statements = readFileSync(resolve(MIGRATIONS, migration, 'migration.sql'), 'utf8').split(
      '--> statement-breakpoint',
    );
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
    INSERT INTO assets (id, campaign_id, uploaded_by_id, path, mime_type, size)
    VALUES ('a1', 'c1', 'u1', 'c1/a1.jpg', 'image/jpeg', 1000);
  `);
  return sqlite;
}

function insertScene(sqlite: Database.Database, id = 's1') {
  sqlite
    .prepare(
      `INSERT INTO scenes (id, campaign_id, name, map_asset_id, map_width, map_height, grid_cell_size)
       VALUES (?, 'c1', 'Estrada de Triboar', 'a1', 3000, 2000, 100)`,
    )
    .run(id);
}

/** The migration that brought scenes and `active_scene_id`. */
const SCENES_MIGRATION = FILES.indexOf('20261112183533_ambiguous_oracle');

test('a campaign stored before the battlefield has no scene open', () => {
  assert.notEqual(SCENES_MIGRATION, -1);
  const sqlite = new Database(':memory:');
  apply(sqlite, FILES.slice(0, SCENES_MIGRATION));
  sqlite.exec(`INSERT INTO campaigns (id, name, invite_code) VALUES ('c1', 'Ecos de Phandalin', 'ABC123')`);

  apply(sqlite, FILES.slice(SCENES_MIGRATION));

  const row = sqlite.prepare('SELECT active_scene_id FROM campaigns').get();
  assert.deepEqual(row, { active_scene_id: null });
  sqlite.close();
});

test('a new scene has a snapping grid at no offset, no fog and version 0', () => {
  const sqlite = migrated();
  insertScene(sqlite);
  const row = sqlite
    .prepare(
      `SELECT grid_enabled, grid_offset_x, grid_offset_y, snap_to_grid, fog_enabled, fog_revealed, version
       FROM scenes`,
    )
    .get();
  assert.deepEqual(row, {
    grid_enabled: 1,
    grid_offset_x: 0,
    grid_offset_y: 0,
    snap_to_grid: 1,
    fog_enabled: 0,
    fog_revealed: '[]',
    version: 0,
  });
  sqlite.close();
});

test('the map of a scene cannot be deleted while the scene exists', () => {
  const sqlite = migrated();
  insertScene(sqlite);
  assert.throws(() => sqlite.exec(`DELETE FROM assets WHERE id = 'a1'`), /FOREIGN KEY/);
  sqlite.exec(`DELETE FROM scenes WHERE id = 's1'; DELETE FROM assets WHERE id = 'a1';`);
  const count = sqlite.prepare('SELECT count(*) AS n FROM assets').get() as { n: number };
  assert.equal(count.n, 0);
  sqlite.close();
});

test('deleting a campaign removes its scenes and their maps', () => {
  const sqlite = migrated();
  insertScene(sqlite);
  sqlite.exec(`DELETE FROM campaigns WHERE id = 'c1'`);
  for (const table of ['scenes', 'assets']) {
    const count = sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number };
    assert.equal(count.n, 0, table);
  }
  sqlite.close();
});

// --- Tokens ----------------------------------------------------------------

/** A scene with a character, a statblock and an encounter with one monster. */
function withTokenOrigins() {
  const sqlite = migrated();
  insertScene(sqlite);
  sqlite.exec(`
    INSERT INTO characters (id, campaign_id, owner_id, name, race, class, level, ability_scores, hp, ac, skills, saves, attacks, features)
    VALUES ('ch1', 'c1', 'u1', 'Brina', 'Anã', 'Guerreira', 3, '{}', 30, 16, '[]', '[]', '[]', '[]');
    INSERT INTO statblocks (id, campaign_id, name, ac, hp_average, ability_scores, attacks)
    VALUES ('sb1', 'c1', 'Goblin', 15, 7, '{}', '[]');
    INSERT INTO encounters (id, campaign_id, name) VALUES ('e1', 'c1', 'Emboscada');
    INSERT INTO combatants (id, encounter_id, source, statblock_id, name) VALUES ('cb1', 'e1', 'statblock', 'sb1', 'Goblin 1');
  `);
  return sqlite;
}

function insertToken(sqlite: Database.Database, id: string, columns: Record<string, string>) {
  const names = ['id', 'scene_id', 'x', 'y', ...Object.keys(columns)];
  const values = [id, 's1', 150, 250, ...Object.values(columns)];
  sqlite.prepare(`INSERT INTO tokens (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).run(...values);
}

function tokenIds(sqlite: Database.Database) {
  return (sqlite.prepare('SELECT id FROM tokens ORDER BY id').all() as { id: string }[]).map((row) => row.id);
}

test('a new token is visible', () => {
  const sqlite = withTokenOrigins();
  insertToken(sqlite, 't1', { kind: 'character', character_id: 'ch1' });
  assert.deepEqual(sqlite.prepare('SELECT hidden, label, size FROM tokens').get(), { hidden: 0, label: null, size: null });
  sqlite.close();
});

test('a character and a combatant each have at most one token per scene', () => {
  const sqlite = withTokenOrigins();
  insertToken(sqlite, 't1', { kind: 'character', character_id: 'ch1' });
  insertToken(sqlite, 't2', { kind: 'combatant', combatant_id: 'cb1' });
  assert.throws(() => insertToken(sqlite, 't3', { kind: 'character', character_id: 'ch1' }), /UNIQUE/);
  assert.throws(() => insertToken(sqlite, 't4', { kind: 'combatant', combatant_id: 'cb1' }), /UNIQUE/);
  // Free tokens repeat freely: the unique pairs ignore their nulls.
  insertToken(sqlite, 't5', { kind: 'free', label: 'Barril', size: 'medium' });
  insertToken(sqlite, 't6', { kind: 'free', label: 'Barril', size: 'medium' });
  assert.deepEqual(tokenIds(sqlite), ['t1', 't2', 't5', 't6']);
  sqlite.close();
});

test('removing the character or the combatant removes its token', () => {
  const sqlite = withTokenOrigins();
  insertToken(sqlite, 't1', { kind: 'character', character_id: 'ch1' });
  insertToken(sqlite, 't2', { kind: 'combatant', combatant_id: 'cb1' });
  insertToken(sqlite, 't3', { kind: 'free', label: 'Barril', size: 'medium' });
  sqlite.exec(`DELETE FROM characters WHERE id = 'ch1'`);
  assert.deepEqual(tokenIds(sqlite), ['t2', 't3']);
  // Deleting the encounter takes its combatants, and their tokens with them.
  sqlite.exec(`DELETE FROM encounters WHERE id = 'e1'`);
  assert.deepEqual(tokenIds(sqlite), ['t3']);
  sqlite.close();
});

test('a free token outlives the bestiary entry it was copied from', () => {
  const sqlite = withTokenOrigins();
  insertToken(sqlite, 't1', { kind: 'free', statblock_id: 'sb1', label: 'Goblin', size: 'small' });
  sqlite.exec(`DELETE FROM statblocks WHERE id = 'sb1'`);
  assert.deepEqual(sqlite.prepare('SELECT statblock_id, label FROM tokens').get(), { statblock_id: null, label: 'Goblin' });
  sqlite.close();
});

test('deleting a scene removes its tokens', () => {
  const sqlite = withTokenOrigins();
  insertToken(sqlite, 't1', { kind: 'character', character_id: 'ch1' });
  sqlite.exec(`DELETE FROM scenes WHERE id = 's1'`);
  assert.deepEqual(tokenIds(sqlite), []);
  sqlite.close();
});
