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

test('a campaign stored before the battlefield has no scene open', () => {
  const sqlite = new Database(':memory:');
  apply(sqlite, FILES.slice(0, -1));
  sqlite.exec(`INSERT INTO campaigns (id, name, invite_code) VALUES ('c1', 'Ecos de Phandalin', 'ABC123')`);

  apply(sqlite, FILES.slice(-1));

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
