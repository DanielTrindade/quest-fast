import { formatMeters, movementCost, squaresBetween, type SquareGrid } from '@quest-fast/shared';

type Point = { x: number; y: number };

/** One square of a route: where the token's centre passes, and what it costs to get there. */
export type RouteStep = Point & { meters: number };

const casas = (squares: number) => (squares === 1 ? '1 casa' : `${squares} casas`);

/**
 * The squares a move walks through, one per step, from `from` (left out) to
 * `to`: the diagonal steps spread along the way, as a straight line drawn on
 * the grid. Every square costs the same, so this is one of the cheapest routes.
 */
export function routeBetween(from: Point, to: Point, grid: SquareGrid): RouteStep[] {
  const steps = squaresBetween(from, to, grid);
  if (steps === 0) return [];
  const columns = (to.x - from.x) / grid.cellSize;
  const rows = (to.y - from.y) / grid.cellSize;
  // Both ends on the grid: every step lands on a whole square. Off it (no snapping), it walks the line.
  const whole = Math.abs(columns - Math.round(columns)) < 1e-6 && Math.abs(rows - Math.round(rows)) < 1e-6;
  return Array.from({ length: steps }, (_, index) => {
    const k = (index + 1) / steps;
    const point = whole
      ? { x: from.x + Math.round(columns * k) * grid.cellSize, y: from.y + Math.round(rows * k) * grid.cellSize }
      : { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    return { ...point, meters: movementCost(from, point, grid) };
  });
}

/**
 * Where a move past what is left stops: the last square of its route still
 * within `metersLeft`. Null when the move fits, or when not even one square does.
 */
export function stopAtLimit(from: Point, to: Point, grid: SquareGrid, metersLeft: number): Point | null {
  const route = routeBetween(from, to, grid);
  const last = route[route.length - 1];
  if (!last || last.meters <= metersLeft + 1e-6) return null;
  const within = route.filter((step) => step.meters <= metersLeft + 1e-6);
  const stop = within[within.length - 1];
  return stop ? { x: stop.x, y: stop.y } : null;
}

/**
 * What the label beside a dragged token says: the squares, the metres and
 * what is left; past the limit, how far past and, when it stops short, where.
 */
export function describeDrag(from: Point, to: Point, grid: SquareGrid, metersLeft: number, stop: Point | null): string {
  const squares = squaresBetween(from, to, grid);
  if (squares === 0) return 'Fica onde está.';
  const meters = movementCost(from, to, grid);
  if (meters <= metersLeft + 1e-6) {
    return `${casas(squares)}, ${formatMeters(meters)}. Sobram ${formatMeters(Math.max(0, metersLeft - meters))}.`;
  }
  const over = routeBetween(from, to, grid).filter((step) => step.meters > metersLeft + 1e-6).length;
  const past = `${casas(over)} além do deslocamento.`;
  if (!stop) return past;
  return `${past} Para em ${casas(squaresBetween(from, stop, grid))}, ${formatMeters(movementCost(from, stop, grid))}.`;
}
