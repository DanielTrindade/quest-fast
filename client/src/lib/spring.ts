/**
 * A damped spring on one value: `stiffness` pulls it to `target`, `damping`
 * brakes it. Only a released drag uses one; everything else in the design
 * system eases with `--ease-settle`.
 */
export type Spring = {
  value: number;
  /** Units per second. */
  velocity: number;
  target: number;
  stiffness: number;
  damping: number;
};

export type SpringConfig = Pick<Spring, 'stiffness' | 'damping'>;

/** A dropped token on its cell: a slight overshoot, settled in about 300 ms. */
export const LAND: SpringConfig = { stiffness: 420, damping: 26 };
/** Coming down on the table: underdamped, so it sinks a little before resting. */
export const SINK: SpringConfig = { stiffness: 520, damping: 16 };
/** The server said no: back fast, with no bounce, so it never reads as a second try. */
export const REFUSE: SpringConfig = { stiffness: 700, damping: 55 };

const REST_VELOCITY = 0.01;
const REST_DISTANCE = 0.001;
/** Small fixed steps keep a stiff spring stable over a slow frame. */
const STEP_SECONDS = 0.004;

/** Ease-out with the same feel as `--ease-settle`, for what moves on the canvas. */
export const easeSettle = (t: number) => 1 - (1 - t) ** 4;

/**
 * Ease-in-out, for a line crossing the map: an ease-out would spend most of
 * the move in its first frames, and the line would seem to just vanish.
 */
export const easeAcross = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export function createSpring(value: number, config: SpringConfig): Spring {
  return { value, velocity: 0, target: value, ...config };
}

/**
 * Advances the spring by `seconds` and says whether it is still moving. At
 * rest it lands exactly on the target.
 */
export function stepSpring(spring: Spring, seconds: number): boolean {
  const steps = Math.max(1, Math.ceil(seconds / STEP_SECONDS));
  const step = seconds / steps;
  for (let index = 0; index < steps; index += 1) {
    const force = -spring.stiffness * (spring.value - spring.target) - spring.damping * spring.velocity;
    spring.velocity += force * step;
    spring.value += spring.velocity * step;
  }
  const moving = Math.abs(spring.velocity) > REST_VELOCITY || Math.abs(spring.value - spring.target) > REST_DISTANCE;
  if (!moving) {
    spring.value = spring.target;
    spring.velocity = 0;
  }
  return moving;
}
