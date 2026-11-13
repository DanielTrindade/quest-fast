import test from 'node:test';
import assert from 'node:assert/strict';
import type { MoveThrottle } from '../src/lib/move-throttle.ts';
import { createTokenDrag } from '../src/lib/token-drag.ts';

type Point = { x: number; y: number };

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness() {
  const grabs: { tokenId: string; answer: ReturnType<typeof deferred> }[] = [];
  const saves: { tokenId: string; point: Point; answer: ReturnType<typeof deferred> }[] = [];
  const sent: { tokenId: string; point: Point }[] = [];
  const refusals: { tokenId: string; error: unknown }[] = [];
  let stops = 0;
  const throttle: MoveThrottle = {
    move: (tokenId, point) => sent.push({ tokenId, point }),
    stop: () => { stops += 1; },
  };
  const drag = createTokenDrag({
    grab: (tokenId) => {
      const answer = deferred();
      grabs.push({ tokenId, answer });
      return answer.promise;
    },
    save: (tokenId, point) => {
      const answer = deferred();
      saves.push({ tokenId, point, answer });
      return answer.promise;
    },
    throttle,
    refused: (tokenId, error) => refusals.push({ tokenId, error }),
  });
  return { drag, grabs, saves, sent, refusals, stops: () => stops };
}

const origin = { x: 100, y: 100 };

test('moves go out only once the lock is held, starting from the newest position', async () => {
  const { drag, grabs, sent } = harness();
  drag.grab('t1', origin);
  drag.drag('t1', { x: 110, y: 100 });
  drag.drag('t1', { x: 120, y: 100 });
  assert.equal(sent.length, 0);

  grabs[0].answer.resolve();
  await settle();
  assert.deepEqual(sent, [{ tokenId: 't1', point: { x: 120, y: 100 } }]);
  drag.drag('t1', { x: 130, y: 100 });
  assert.equal(sent.length, 2);
});

test('a drop made before the lock arrives is saved once it does', async () => {
  const { drag, grabs, saves } = harness();
  drag.grab('t1', origin);
  drag.drag('t1', { x: 140, y: 100 });
  drag.drop('t1', { x: 140, y: 100 });
  assert.equal(saves.length, 0);

  grabs[0].answer.resolve();
  await settle();
  assert.deepEqual(saves.map((save) => save.point), [{ x: 140, y: 100 }]);
});

test('a token is not grabbed again while its last drop is unanswered', async () => {
  const { drag, grabs, saves, sent } = harness();
  drag.grab('t1', origin);
  drag.drop('t1', { x: 140, y: 100 });
  assert.equal(drag.settling('t1'), true);

  // A second gesture before the first one settled: refused here, so the late
  // grant (and the save that releases the lock) can never land on it.
  drag.grab('t1', { x: 140, y: 100 });
  drag.drag('t1', { x: 200, y: 100 });
  assert.equal(grabs.length, 1);

  grabs[0].answer.resolve();
  await settle();
  assert.equal(saves.length, 1);
  assert.equal(sent.length, 0);
  assert.equal(drag.settling('t1'), true);

  saves[0].answer.resolve();
  await settle();
  assert.equal(drag.settling('t1'), false);
  drag.grab('t1', { x: 140, y: 100 });
  assert.equal(grabs.length, 2);
});

test('a refused lock puts the token back and frees it for the next gesture', async () => {
  const { drag, grabs, refusals, saves } = harness();
  drag.grab('t1', origin);
  drag.drop('t1', { x: 140, y: 100 });
  const locked = new Error('Lia está movendo este token.');
  grabs[0].answer.reject(locked);
  await settle();

  assert.deepEqual(refusals, [{ tokenId: 't1', error: locked }]);
  assert.equal(saves.length, 0);
  assert.equal(drag.settling('t1'), false);
});

test('a failed drop is refused; a cancelled one goes back quietly', async () => {
  const { drag, grabs, saves, refusals } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drop('t1', { x: 140, y: 100 });
  saves[0].answer.reject(new Error('falhou'));
  await settle();
  assert.equal(refusals.length, 1);
  assert.equal(drag.settling('t1'), false);

  drag.grab('t1', origin);
  drag.cancel('t1');
  grabs[1].answer.resolve();
  await settle();
  // Back to where it was saved, which releases the lock.
  assert.deepEqual(saves[1].point, origin);
  saves[1].answer.reject(new Error('sumiu'));
  await settle();
  assert.equal(refusals.length, 1);
  assert.equal(drag.settling('t1'), false);
});

test('a lock refused after a pinch says nothing', async () => {
  const { drag, grabs, refusals } = harness();
  drag.grab('t1', origin);
  drag.cancel('t1');
  grabs[0].answer.reject(new Error('Lia está movendo este token.'));
  await settle();
  assert.equal(refusals.length, 0);
});

test('a gesture left for another token goes back and frees its token', async () => {
  const { drag, grabs, saves, sent } = harness();
  drag.grab('t1', origin);
  drag.grab('t2', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drag('t1', { x: 300, y: 300 });
  assert.equal(sent.length, 0);
  assert.deepEqual(saves.map((save) => [save.tokenId, save.point]), [['t1', origin]]);
  saves[0].answer.resolve();
  await settle();
  assert.equal(drag.settling('t1'), false);
});
