import { formatMeters, movementCost, reachArea, squaresBetween, type Size } from '@quest-fast/shared';
import type { MapView } from './map-view';
import { toScreenPoint } from './token-geometry';

type Point = { x: number; y: number };

function colours(themed: Element) {
  const style = getComputedStyle(themed);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    reach: read('--color-accent'),
    over: read('--color-danger'),
    disc: read('--color-surface-raised'),
    text: read('--color-text-primary'),
    halo: read('--color-surface-secret'),
    font: read('--font-sans') || 'sans-serif',
  };
}

/**
 * The whole area a token can still reach (every square up to the metres
 * left, diagonals included): a tinted block with its outline, under the
 * tokens. Nothing when no square is left.
 */
export function drawReach(
  context: CanvasRenderingContext2D,
  input: { token: Point & { size: Size }; meters: number; cellSize: number; map: { width: number; height: number }; view: MapView; themed: Element },
) {
  const area = reachArea(input.token, input.meters, { cellSize: input.cellSize }, input.map);
  if (area.squares === 0) return;
  const { reach } = colours(input.themed);
  const topLeft = toScreenPoint(input.view, { x: area.left, y: area.top });
  const bottomRight = toScreenPoint(input.view, { x: area.right, y: area.bottom });
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  context.save();
  context.globalAlpha = 0.16;
  context.fillStyle = reach;
  context.fillRect(topLeft.x, topLeft.y, width, height);
  context.globalAlpha = 0.9;
  context.lineWidth = 2;
  context.strokeStyle = reach;
  context.setLineDash([8, 5]);
  context.strokeRect(topLeft.x + 1, topLeft.y + 1, width - 2, height - 2);
  context.restore();
}

/** What a move costs, as the table reads it: "3 casas · 4,5 m". */
export function describeMove(from: Point, to: Point, cellSize: number): { squares: number; meters: number; label: string } {
  const squares = squaresBetween(from, to, cellSize);
  const meters = movementCost(from, to, cellSize);
  return { squares, meters, label: `${squares === 1 ? '1 casa' : `${squares} casas`} · ${formatMeters(meters)}` };
}

/**
 * A move on its way: a straight line from where the token is saved to where
 * it would rest, with its cost. Past the metres left, it turns to the
 * danger tone.
 */
export function drawMovePath(
  context: CanvasRenderingContext2D,
  input: { from: Point; to: Point; cellSize: number; metersLeft: number; view: MapView; themed: Element },
) {
  const move = describeMove(input.from, input.to, input.cellSize);
  if (move.squares === 0) return;
  const palette = colours(input.themed);
  const tone = move.meters > input.metersLeft + 1e-6 ? palette.over : palette.reach;
  const start = toScreenPoint(input.view, input.from);
  const end = toScreenPoint(input.view, input.to);

  context.save();
  context.lineCap = 'round';
  context.setLineDash([10, 6]);
  context.lineWidth = 5;
  context.strokeStyle = palette.halo;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.lineWidth = 3;
  context.strokeStyle = tone;
  context.stroke();
  context.setLineDash([]);

  // The cost, halfway along, on a pill that stays readable over any map.
  const size = 13;
  context.font = `600 ${size}px ${palette.font}`;
  const width = context.measureText(move.label).width + 16;
  const height = size + 10;
  const x = (start.x + end.x) / 2 - width / 2;
  const y = (start.y + end.y) / 2 - height / 2;
  context.beginPath();
  context.roundRect(x, y, width, height, height / 2);
  context.fillStyle = palette.disc;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = tone;
  context.stroke();
  context.fillStyle = palette.text;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(move.label, x + width / 2, y + height / 2 + 0.5);
  context.restore();
}
