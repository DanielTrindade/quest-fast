import { formatMeters, movementCost, reachArea, squaresBetween, type Size, type SquareGrid } from '@quest-fast/shared';
import type { MapView } from './map-view';
import { toScreenPoint } from './token-geometry';

type Point = { x: number; y: number };

function colours(themed: Element) {
  const style = getComputedStyle(themed);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    reach: read('--color-accent'),
    over: read('--color-danger'),
    halo: read('--color-surface-secret'),
    range: read('--color-danger'),
  };
}

/** An attack's range on the map: the token it starts from and the distances, in metres. */
export type ShownRange = { tokenId: string; normal: number; long: number | null };

/** One outline with its halo, so it reads over any map. */
function outline(context: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }, stroke: string, halo: string, width: number, alpha: number) {
  context.globalAlpha = 0.5 * alpha;
  context.lineWidth = width + 2;
  context.strokeStyle = halo;
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.globalAlpha = alpha;
  context.lineWidth = width;
  context.strokeStyle = stroke;
  context.strokeRect(box.x, box.y, box.width, box.height);
}

/**
 * The squares an attack reaches from its token, counted like a move (the
 * diagonal is one square): the normal range as a firm outline over a faint
 * veil, and the long range, when there is one, as a lighter outline around
 * it. In the danger tone, an attack's: the grid's lines are light and the
 * accent tiles are the move, so neither may draw it.
 */
export function drawAttackRange(
  context: CanvasRenderingContext2D,
  input: { token: Point & { size: Size }; normal: number; long: number | null; cellSize: number; map: { width: number; height: number }; view: MapView; themed: Element },
) {
  const { range, halo } = colours(input.themed);
  const box = (meters: number) => {
    const area = reachArea(input.token, meters, { cellSize: input.cellSize }, input.map);
    const from = toScreenPoint(input.view, { x: area.left, y: area.top });
    const to = toScreenPoint(input.view, { x: area.right, y: area.bottom });
    return { x: from.x + 1, y: from.y + 1, width: to.x - from.x - 2, height: to.y - from.y - 2 };
  };
  const normal = box(input.normal);
  context.save();
  if (input.long !== null) outline(context, box(input.long), range, halo, 2, 0.5);
  context.globalAlpha = 0.1;
  context.fillStyle = range;
  context.fillRect(normal.x, normal.y, normal.width, normal.height);
  outline(context, normal, range, halo, 3, 0.95);
  context.restore();
}

/** Below this side on screen a tile is too small to read as one: the area is a plain tint. */
const MIN_TILE = 14;

/**
 * The whole area a token can still reach (every square up to the metres
 * left, diagonals included), under the tokens: one tile per square, and a
 * continuous outline where the reach ends. `alpha` fades it as a whole: it
 * is fainter while the token only sits selected than while it is dragged.
 */
export function drawReach(
  context: CanvasRenderingContext2D,
  input: { token: Point & { size: Size }; meters: number; cellSize: number; map: { width: number; height: number }; view: MapView; themed: Element; alpha?: number },
) {
  const area = reachArea(input.token, input.meters, { cellSize: input.cellSize }, input.map);
  if (area.squares === 0) return;
  const { reach, halo } = colours(input.themed);
  const alpha = input.alpha ?? 1;
  const topLeft = toScreenPoint(input.view, { x: area.left, y: area.top });
  const bottomRight = toScreenPoint(input.view, { x: area.right, y: area.bottom });
  const side = input.cellSize * input.view.scale;
  context.save();
  context.fillStyle = reach;
  context.strokeStyle = reach;
  if (side < MIN_TILE) {
    context.globalAlpha = 0.16 * alpha;
    context.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  } else {
    // The area starts on a square's edge (the token is on the grid), or is cut by the map's.
    const inset = Math.min(3, side * 0.06);
    context.lineWidth = 1;
    context.beginPath();
    for (let top = area.top; top < area.bottom - 1e-6; top += input.cellSize) {
      for (let left = area.left; left < area.right - 1e-6; left += input.cellSize) {
        const from = toScreenPoint(input.view, { x: left, y: top });
        const to = toScreenPoint(input.view, { x: Math.min(left + input.cellSize, area.right), y: Math.min(top + input.cellSize, area.bottom) });
        context.roundRect(from.x + inset, from.y + inset, to.x - from.x - inset * 2, to.y - from.y - inset * 2, 4);
      }
    }
    context.globalAlpha = 0.16 * alpha;
    context.fill();
    context.globalAlpha = 0.35 * alpha;
    context.stroke();
  }
  // Solid, not dashed: in the design system a dashed line is a ghost or something hidden.
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  context.globalAlpha = 0.5 * alpha;
  context.lineWidth = 4;
  context.strokeStyle = halo;
  context.strokeRect(topLeft.x + 1, topLeft.y + 1, width - 2, height - 2);
  context.globalAlpha = 0.95 * alpha;
  context.lineWidth = 2;
  context.strokeStyle = reach;
  context.strokeRect(topLeft.x + 1, topLeft.y + 1, width - 2, height - 2);
  context.restore();
}

/** What a move costs, as the table reads it: "3 casas, 4,5 m". */
export function describeMove(from: Point, to: Point, grid: SquareGrid): { squares: number; meters: number; label: string } {
  const squares = squaresBetween(from, to, grid);
  const meters = movementCost(from, to, grid);
  return { squares, meters, label: `${squares === 1 ? '1 casa' : `${squares} casas`}, ${formatMeters(meters)}` };
}

/** A point of a route on the map; `over` once it is past the metres left. */
export type RoutePoint = Point & { over: boolean };

/**
 * A move's route, square by square: a line through the squares' centres
 * with a dot on each one walked through, in the reach's tone, turning to the
 * danger tone from the first square past the metres left. `visible` keeps
 * only part of it (from 0 to 1 along its length): a route reeling in after
 * the drop. The cost is in the DOM, beside the token: the canvas has no text.
 */
export function drawRoute(
  context: CanvasRenderingContext2D,
  input: { points: readonly RoutePoint[]; view: MapView; themed: Element; visible?: readonly [number, number] },
) {
  const points = input.points.map((point) => ({ ...toScreenPoint(input.view, point), over: point.over }));
  if (points.length < 2) return;
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1]! + Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y));
  }
  const total = lengths[lengths.length - 1]!;
  const [from, to] = input.visible ?? [0, 1];
  const start = total * from;
  const end = total * to;
  if (end - start < 0.5) return;
  const palette = colours(input.themed);
  const along = (index: number, distance: number) => {
    const before = points[index - 1]!;
    const after = points[index]!;
    const k = (distance - lengths[index - 1]!) / (lengths[index]! - lengths[index - 1]! || 1);
    return { x: before.x + (after.x - before.x) * k, y: before.y + (after.y - before.y) * k };
  };

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let index = 1; index < points.length; index += 1) {
    if (lengths[index]! <= start || lengths[index - 1]! >= end) continue;
    const a = lengths[index - 1]! < start ? along(index, start) : points[index - 1]!;
    const b = lengths[index]! > end ? along(index, end) : points[index]!;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.globalAlpha = 0.55;
    context.lineWidth = 6;
    context.strokeStyle = palette.halo;
    context.stroke();
    context.globalAlpha = 1;
    context.lineWidth = 2.5;
    context.strokeStyle = points[index]!.over ? palette.over : palette.reach;
    context.stroke();
  }
  // A dot on each square walked through; the last one is under the token.
  for (let index = 1; index < points.length - 1; index += 1) {
    if (lengths[index]! < start || lengths[index]! > end) continue;
    const point = points[index]!;
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.globalAlpha = 0.7;
    context.fillStyle = palette.halo;
    context.fill();
    context.beginPath();
    context.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
    context.globalAlpha = 1;
    context.fillStyle = point.over ? palette.over : palette.reach;
    context.fill();
  }
  context.restore();
}
