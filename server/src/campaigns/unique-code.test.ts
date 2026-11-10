import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { campaigns } from '@quest-fast/db';
import { createTestDb } from '../testing.ts';
import { withUniqueCode } from './unique-code.ts';

function seed() {
  const db = createTestDb();
  db.insert(campaigns).values({ id: 'a', name: 'A', description: '', inviteCode: 'AAAAAA' }).run();
  db.insert(campaigns).values({ id: 'b', name: 'B', description: '', inviteCode: 'BBBBBB' }).run();
  return db;
}

function sequence(...codes: string[]) {
  let index = 0;
  return () => codes[Math.min(index++, codes.length - 1)];
}

test('creation retries after a code collision', () => {
  const db = seed();
  const code = withUniqueCode(
    (candidate) => {
      db.insert(campaigns).values({ id: 'c', name: 'C', description: '', inviteCode: candidate }).run();
      return candidate;
    },
    sequence('AAAAAA', 'CCCCCC'),
  );
  assert.equal(code, 'CCCCCC');
  assert.equal(db.select().from(campaigns).where(eq(campaigns.id, 'c')).get()?.inviteCode, 'CCCCCC');
});

test('rotation retries after a code collision', () => {
  const db = seed();
  const code = withUniqueCode(
    (candidate) => {
      db.update(campaigns).set({ inviteCode: candidate }).where(eq(campaigns.id, 'a')).run();
      return candidate;
    },
    sequence('BBBBBB', 'DDDDDD'),
  );
  assert.equal(code, 'DDDDDD');
  assert.equal(db.select().from(campaigns).where(eq(campaigns.id, 'a')).get()?.inviteCode, 'DDDDDD');
});

test('gives up after repeated collisions and rethrows other errors untouched', () => {
  const db = seed();
  assert.throws(() =>
    withUniqueCode(
      (candidate) => db.update(campaigns).set({ inviteCode: candidate }).where(eq(campaigns.id, 'a')).run(),
      () => 'BBBBBB',
    ),
  );
  let calls = 0;
  assert.throws(
    () =>
      withUniqueCode(() => {
        calls++;
        throw new Error('boom');
      }),
    /boom/,
  );
  assert.equal(calls, 1);
});
