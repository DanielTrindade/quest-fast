import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoveThrottle, type MoveThrottleEnvironment } from '../src/lib/move-throttle.ts';

function fakeClock() {
  let time = 0;
  const timers = new Map<number, { run: () => void; at: number }>();
  let next = 1;
  const env: MoveThrottleEnvironment = {
    now: () => time,
    setTimer: (run, ms) => {
      const id = next++;
      timers.set(id, { run, at: time + ms });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
  };
  const advance = (ms: number) => {
    time += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= time) {
        timers.delete(id);
        timer.run();
      }
    }
  };
  return { env, timers, advance };
}

function recorder() {
  const sent: { tokenId: string; x: number; y: number }[] = [];
  return { sent, send: (tokenId: string, point: { x: number; y: number }) => sent.push({ tokenId, ...point }) };
}

test('the first move goes out at once', () => {
  const { env } = fakeClock();
  const { sent, send } = recorder();
  createMoveThrottle(send, { intervalMs: 33, env }).move('t1', { x: 1, y: 2 });
  assert.deepEqual(sent, [{ tokenId: 't1', x: 1, y: 2 }]);
});

test('moves faster than the pace send only the newest, once per interval', () => {
  const { env, advance } = fakeClock();
  const { sent, send } = recorder();
  const throttle = createMoveThrottle(send, { intervalMs: 33, env });

  throttle.move('t1', { x: 0, y: 0 });
  for (let step = 1; step <= 4; step += 1) {
    advance(8);
    throttle.move('t1', { x: step, y: 0 });
  }
  assert.equal(sent.length, 1);

  advance(1);
  assert.deepEqual(sent.map((move) => move.x), [0, 4]);
});

test('the last position before a pause still goes out', () => {
  const { env, advance } = fakeClock();
  const { sent, send } = recorder();
  const throttle = createMoveThrottle(send, { intervalMs: 33, env });

  throttle.move('t1', { x: 0, y: 0 });
  advance(10);
  throttle.move('t1', { x: 5, y: 5 });
  advance(100);
  assert.deepEqual(sent.map((move) => move.x), [0, 5]);
});

test('stopping drops a move still waiting for its slot', () => {
  const { env, timers, advance } = fakeClock();
  const { sent, send } = recorder();
  const throttle = createMoveThrottle(send, { intervalMs: 33, env });

  throttle.move('t1', { x: 0, y: 0 });
  advance(10);
  throttle.move('t1', { x: 9, y: 9 });
  throttle.stop();
  assert.equal(timers.size, 0);
  advance(100);
  assert.deepEqual(sent.map((move) => move.x), [0]);
});
