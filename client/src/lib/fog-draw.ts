import type { FogMode, SceneFog } from '@quest-fast/shared';
import type { FogLook, Point } from './fog-tool';
import type { MapView, Size } from './map-view';

/** A token's value as the canvas needs it: the canvas cannot read a CSS variable. */
function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/** How much of the map the master still sees through the fog. */
export const MASTER_FOG_ALPHA = 0.6;

/**
 * Covers what was not revealed. The map's rectangle and every ring of the
 * revealed area go into one path filled even-odd: a revealed polygon cuts a
 * window, and a hole in it fills back. A player sees it opaque, in the
 * colour behind the map, so hidden reads as "no map here"; the master sees
 * through it, with the revealed edges outlined.
 */
export function drawFog(context: CanvasRenderingContext2D, scene: {
  fog: SceneFog;
  look: FogLook;
  view: MapView;
  map: Size;
  themed: Element;
}) {
  const { fog, look, view, map, themed } = scene;
  if (!fog.enabled) return;
  const at = (x: number, y: number) => [view.x + x * view.scale, view.y + y * view.scale] as const;
  context.beginPath();
  context.rect(view.x, view.y, map.width * view.scale, map.height * view.scale);
  for (const polygon of fog.revealed) {
    for (const ring of polygon) {
      ring.forEach(([x, y], index) => {
        const [sx, sy] = at(x, y);
        if (index === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      });
      context.closePath();
    }
  }
  context.globalAlpha = look === 'player' ? 1 : MASTER_FOG_ALPHA;
  context.fillStyle = token(themed, '--color-surface-secret');
  context.fill('evenodd');
  context.globalAlpha = 1;
  if (look === 'master' && fog.revealed.length > 0) {
    // Only the revealed rings: the map's edge needs no outline.
    context.beginPath();
    for (const polygon of fog.revealed) {
      for (const ring of polygon) {
        ring.forEach(([x, y], index) => {
          const [sx, sy] = at(x, y);
          if (index === 0) context.moveTo(sx, sy);
          else context.lineTo(sx, sy);
        });
        context.closePath();
      }
    }
    context.lineWidth = 1.5;
    context.strokeStyle = token(themed, '--color-accent-text');
    context.stroke();
  }
}

/** What the master is drawing, before it is sent. */
export type FogDraft =
  | { kind: 'rect'; mode: FogMode; rect: { x: number; y: number; width: number; height: number } }
  | { kind: 'polygon'; mode: FogMode; points: readonly Point[]; closing: boolean };

/**
 * The shape being drawn: a dashed outline over a light wash, in the accent
 * to reveal and in the text colour to hide. A polygon shows its points, the
 * first one ringed: pressing it closes the shape.
 */
export function drawFogDraft(context: CanvasRenderingContext2D, draft: FogDraft, view: MapView, themed: Element) {
  const colour = token(themed, draft.mode === 'reveal' ? '--color-accent-text' : '--color-text-primary');
  const at = (point: Point) => ({ x: view.x + point.x * view.scale, y: view.y + point.y * view.scale });
  context.save();
  context.strokeStyle = colour;
  context.fillStyle = colour;
  context.lineWidth = 2;
  context.setLineDash([6, 4]);
  context.beginPath();
  if (draft.kind === 'rect') {
    const { x, y } = at(draft.rect);
    context.rect(x, y, draft.rect.width * view.scale, draft.rect.height * view.scale);
  } else {
    draft.points.forEach((point, index) => {
      const { x, y } = at(point);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    if (draft.closing) context.closePath();
  }
  context.globalAlpha = 0.18;
  if (draft.kind === 'rect' || draft.points.length >= 3) context.fill();
  context.globalAlpha = 1;
  context.stroke();
  context.setLineDash([]);
  if (draft.kind === 'polygon') {
    draft.points.forEach((point, index) => {
      const { x, y } = at(point);
      context.beginPath();
      context.arc(x, y, index === 0 ? 7 : 4, 0, Math.PI * 2);
      if (index === 0) {
        context.lineWidth = 2;
        context.stroke();
      } else {
        context.fill();
      }
    });
  }
  context.restore();
}
