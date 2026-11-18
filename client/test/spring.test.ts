import test from 'node:test';
import assert from 'node:assert/strict';
import { LAND, REFUSE, SINK, createSpring, easeSettle, stepSpring } from '../src/lib/spring.ts';

/**
 * Runs a spring at 60 fps; returns how far past the target it went and when
 * it last was more than half a pixel away (what the eye can see).
 */
function run(spring: ReturnType<typeof createSpring>) {
  const direction = Math.sign(spring.target - spring.value);
  let overshoot = 0;
  let seconds = 0;
  let visible = 0;
  while (stepSpring(spring, 1 / 60) && seconds < 5) {
    seconds += 1 / 60;
    overshoot = Math.max(overshoot, (spring.value - spring.target) * direction);
    if (Math.abs(spring.value - spring.target) > 0.5) visible = seconds;
  }
  return { overshoot, seconds: visible };
}

test('a spring rests exactly on its target', () => {
  const spring = createSpring(0, LAND);
  spring.target = 100;
  run(spring);
  assert.equal(spring.value, 100);
  assert.equal(spring.velocity, 0);
});

test('landing overshoots a little and settles fast; refusing never overshoots', () => {
  const landing = createSpring(0, LAND);
  landing.target = 100;
  const landed = run(landing);
  assert.ok(landed.overshoot > 0 && landed.overshoot < 10, `overshoot ${landed.overshoot}`);
  assert.ok(landed.seconds < 0.5, `settled in ${landed.seconds}s`);

  const refused = createSpring(0, REFUSE);
  refused.target = 100;
  assert.ok(run(refused).overshoot < 0.01);
});

test('the release velocity carries the token past where it would stop', () => {
  const still = createSpring(0, LAND);
  still.target = 100;
  const flung = createSpring(0, LAND);
  flung.target = 100;
  flung.velocity = 2000;
  assert.ok(run(flung).overshoot > run(still).overshoot);
});

test('coming down, the lift dips below the table before resting', () => {
  const lift = createSpring(1, SINK);
  lift.target = 0;
  let lowest = 1;
  while (stepSpring(lift, 1 / 60)) lowest = Math.min(lowest, lift.value);
  assert.ok(lowest < 0, `lowest ${lowest}`);
});

test('a slow frame does not blow a stiff spring up', () => {
  const spring = createSpring(0, REFUSE);
  spring.target = 100;
  stepSpring(spring, 0.25);
  assert.ok(Math.abs(spring.value) < 200);
});

test('the canvas easing starts fast and ends on 1', () => {
  assert.equal(easeSettle(0), 0);
  assert.equal(easeSettle(1), 1);
  assert.ok(easeSettle(0.25) > 0.6);
});
