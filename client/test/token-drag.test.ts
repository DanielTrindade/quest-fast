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
  const saves: { tokenId: string; point: Point; free: boolean; answer: ReturnType<typeof deferred> }[] = [];
  const held: ((Point & { tokenId: string }) | null)[] = [];
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
    save: (tokenId, point, options) => {
      const answer = deferred();
      saves.push({ tokenId, point, free: options?.free === true, answer });
      return answer.promise;
    },
    throttle,
    refused: (tokenId, error) => refusals.push({ tokenId, error }),
    onHeld: (move) => held.push(move),
  });
  return { drag, grabs, saves, sent, refusals, held, stops: () => stops };
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
  // The lock is still ours: going back releases it, and only then the token is free.
  assert.deepEqual(saves[1].point, origin);
  assert.equal(drag.settling('t1'), true);
  saves[1].answer.resolve();
  await settle();
  assert.equal(drag.settling('t1'), false);

  drag.grab('t1', origin);
  drag.cancel('t1');
  grabs[1].answer.resolve();
  await settle();
  // Back to where it was saved, which releases the lock.
  assert.deepEqual(saves[2].point, origin);
  saves[2].answer.reject(new Error('sumiu'));
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

test('in a fight the drop is held: nothing is saved until it is confirmed, and the lock stays alive', async () => {
  const { drag, grabs, saves, sent, held } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drag('t1', { x: 150, y: 100 });
  drag.drop('t1', { x: 150, y: 100 }, { hold: true });
  assert.equal(saves.length, 0);
  assert.deepEqual(held.at(-1), { tokenId: 't1', x: 150, y: 100 });
  assert.deepEqual(sent.at(-1), { tokenId: 't1', point: { x: 150, y: 100 } });
  // Held, the token may be picked up again to adjust the move.
  assert.equal(drag.settling('t1'), false);

  drag.confirm('t1');
  assert.deepEqual(saves.map((save) => [save.point, save.free]), [[{ x: 150, y: 100 }, false]]);
  assert.equal(held.at(-1), null);
});

test('the master confirms a held move without spending', async () => {
  const { drag, grabs, saves } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drop('t1', { x: 200, y: 100 }, { hold: true });
  drag.confirm('t1', { free: true });
  assert.equal(saves[0]?.free, true);
});

test('cancelling a held move puts the token back and releases the lock', async () => {
  const { drag, grabs, saves, held } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drop('t1', { x: 200, y: 100 }, { hold: true });
  drag.cancel('t1');
  assert.deepEqual(saves.map((save) => save.point), [origin]);
  assert.equal(held.at(-1), null);
});

test('picking up a held token again adjusts the same move, with the same lock', async () => {
  const { drag, grabs, saves, held } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drop('t1', { x: 200, y: 100 }, { hold: true });
  drag.grab('t1', { x: 200, y: 100 });
  assert.equal(grabs.length, 1);
  assert.equal(held.at(-1), null);
  drag.drag('t1', { x: 130, y: 100 });
  drag.drop('t1', { x: 130, y: 100 }, { hold: true });
  drag.confirm('t1');
  assert.deepEqual(saves.map((save) => save.point), [{ x: 130, y: 100 }]);
});

test('a confirmed move the server refuses goes back, which releases the lock', async () => {
  const { drag, grabs, saves, refusals } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drop('t1', { x: 900, y: 100 }, { hold: true });
  drag.confirm('t1');
  saves[0]!.answer.reject(new Error('O movimento custa 12 m e restam 9 m neste turno.'));
  await settle();
  assert.equal(refusals.length, 1);
  assert.deepEqual(saves.map((save) => save.point), [{ x: 900, y: 100 }, origin]);
});

test('a gesture whose lock the server let go is forgotten: nothing is saved, and it is over', async () => {
  const { drag, grabs, saves, held } = harness();
  drag.grab('t1', origin);
  grabs[0].answer.resolve();
  await settle();
  drag.drop('t1', { x: 150, y: 100 }, { hold: true });
  drag.forget('t1');
  await settle();
  assert.equal(saves.length, 0);
  assert.equal(held.at(-1), null);
  assert.equal(drag.settling('t1'), false);
  assert.equal(drag.active(), null);
});

test('a lock refused after the confirmation still ends the gesture, so the next one starts clean', async () => {
  const settled: string[] = [];
  const grabs: { answer: ReturnType<typeof deferred> }[] = [];
  const saves: Point[] = [];
  const drag = createTokenDrag({
    grab: () => {
      const answer = deferred();
      grabs.push({ answer });
      return answer.promise;
    },
    save: (_tokenId, point) => {
      saves.push(point);
      return Promise.resolve();
    },
    throttle: { move: () => {}, stop: () => {} },
    refused: () => {},
    onSettled: (tokenId) => settled.push(tokenId),
  });
  drag.grab('t1', origin);
  drag.drop('t1', { x: 150, y: 100 }, { hold: true });
  drag.confirm('t1');
  grabs[0]!.answer.reject(new Error('Lia está movendo este token.'));
  await settle();
  assert.deepEqual(settled, ['t1']);
  assert.equal(saves.length, 0);
  assert.equal(drag.settling('t1'), false);
});
