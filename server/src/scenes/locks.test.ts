import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenLocks, type HeldLock } from './locks.ts';

function clock(start = 1000) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

const REQUEST = { campaignId: 'c1', sceneId: 's1', tokenId: 't1', userId: 'u1', userName: 'Rafael', mapWidth: 600, mapHeight: 400 };

test('a grab locks the token for its holder only, until the TTL runs out', () => {
  const time = clock();
  const locks = createTokenLocks({ ttlMs: 3000, now: time.now });
  assert.equal(locks.grab(REQUEST).ok, true);
  assert.equal(locks.grab(REQUEST).ok, true);
  const other = locks.grab({ ...REQUEST, userId: 'u2', userName: 'Bia' });
  assert.ok(!other.ok && other.holder.userId === 'u1');

  time.advance(3000);
  assert.equal(locks.holder('t1'), undefined);
  assert.equal(locks.grab({ ...REQUEST, userId: 'u2', userName: 'Bia' }).ok, true);
});

test('a move renews the lock and keeps the position; a stranger cannot move', () => {
  const time = clock();
  const locks = createTokenLocks({ ttlMs: 3000, now: time.now });
  locks.grab(REQUEST);
  time.advance(2500);
  assert.equal(locks.move('t1', 'u2', 1, 1), null);
  assert.deepEqual(locks.move('t1', 'u1', 30, 40)?.last, { x: 30, y: 40 });
  time.advance(2500);
  assert.equal(locks.holder('t1')?.userId, 'u1');
});

test('release and clear drop the lock quietly; abandon and expiry call the handler', async () => {
  const locks = createTokenLocks({ ttlMs: 20 });
  const abandoned: HeldLock[] = [];
  locks.onAbandon((lock) => abandoned.push(lock));

  locks.grab(REQUEST);
  locks.release('t1', 'u2');
  assert.ok(locks.holder('t1'));
  locks.release('t1', 'u1');
  locks.grab({ ...REQUEST, tokenId: 't2' });
  locks.clear('t2');
  assert.deepEqual([locks.holder('t1'), locks.holder('t2')], [undefined, undefined]);

  locks.grab(REQUEST);
  locks.grab({ ...REQUEST, tokenId: 't2', campaignId: 'c2' });
  locks.move('t1', 'u1', 5, 6);
  locks.abandon('c1', 'u1');
  assert.deepEqual(abandoned.map((lock) => [lock.tokenId, lock.last]), [['t1', { x: 5, y: 6 }]]);

  // The other campaign's lock runs out on its own.
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(abandoned.map((lock) => lock.tokenId), ['t1', 't2']);
});
