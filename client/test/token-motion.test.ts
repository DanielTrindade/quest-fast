import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTION_DELAY_MS,
  MOTION_STALE_MS,
  createMotionStore,
  createTrack,
  positionAt,
  pushSample,
} from '../src/lib/token-motion.ts';

/** Samples every 33 ms of the server's clock, arriving 100 ms later on a clock 5000 ms ahead. */
function steadyTrack() {
  const track = createTrack();
  for (let index = 0; index <= 4; index += 1) {
    const ts = 1000 + index * 33;
    pushSample(track, { x: index * 33, y: 0, ts }, ts + 5100);
  }
  return track;
}

test('the receiver draws one interval plus the jitter in the past, interpolating', () => {
  const track = steadyTrack();
  // The offset comes from the arrivals: 5100. Drawing at local 6150 means server 1050 - 63 = 987: before the first sample.
  assert.deepEqual(positionAt(track, 6150), { x: 0, y: 0 });
  // Server time 1050 lies between the samples at 1033 and 1066: x moves with the server's clock.
  assert.deepEqual(positionAt(track, 5100 + 1050 + MOTION_DELAY_MS), { x: 50, y: 0 });
});

test('past the newest sample the token holds there, without guessing ahead', () => {
  const track = steadyTrack();
  assert.deepEqual(positionAt(track, 5100 + 2000), { x: 132, y: 0 });
});

test('with reduced motion the token jumps to the newest sample', () => {
  const track = steadyTrack();
  assert.deepEqual(positionAt(track, 6150, { reducedMotion: true }), { x: 132, y: 0 });
});

test('samples out of order are placed by the server clock, and the least delayed one sets the offset', () => {
  const track = createTrack();
  pushSample(track, { x: 66, y: 0, ts: 1066 }, 6200);
  pushSample(track, { x: 0, y: 0, ts: 1000 }, 6210);
  pushSample(track, { x: 33, y: 0, ts: 1033 }, 6133);
  assert.deepEqual(track.samples.map((sample) => sample.at), [1000, 1033, 1066]);
  assert.equal(track.offset, 5100);
});

test('a track keeps only its newest samples', () => {
  const track = createTrack();
  for (let index = 0; index < 40; index += 1) pushSample(track, { x: index, y: 0, ts: index }, index);
  assert.equal(track.samples.length, 16);
  assert.equal(track.samples[0].x, 24);
});

test('a silent drag is over: the store forgets it and stops animating', () => {
  const store = createMotionStore();
  let woken = 0;
  const stop = store.subscribe(() => (woken += 1));
  store.push({ tokenId: 't1', x: 10, y: 20, ts: 1000 }, 2000);
  assert.equal(woken, 1);
  assert.equal(store.animating(2000 + MOTION_STALE_MS), true);
  assert.deepEqual(store.positionOf('t1', 2010), { x: 10, y: 20 });

  assert.equal(store.positionOf('t1', 2001 + MOTION_STALE_MS), null);
  assert.equal(store.animating(2001 + MOTION_STALE_MS), false);
  assert.equal(store.positionOf('t1', 2010), null);

  store.push({ tokenId: 't2', x: 1, y: 1, ts: 0 }, 0);
  store.clear('t2');
  assert.equal(store.positionOf('t2', 1), null);
  stop();
  store.push({ tokenId: 't3', x: 1, y: 1, ts: 0 }, 0);
  assert.equal(woken, 2);
});
