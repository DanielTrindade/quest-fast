import type { GridSettings } from '@quest-fast/shared';
import { gridLines, type MapView, type Size } from './map-view';

/** A token's value as the canvas needs it: the canvas cannot read a CSS variable. */
function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/**
 * Draws one frame: the map where the view puts it and the grid over its
 * visible part. `themed` is the element whose tokens colour the grid.
 */
export function drawMap(context: CanvasRenderingContext2D, scene: {
  image: HTMLImageElement | null;
  view: MapView | null;
  map: Size;
  viewport: Size;
  grid: GridSettings;
  themed: Element;
}) {
  const { image, view, map, viewport, grid } = scene;
  const dpr = window.devicePixelRatio || 1;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);
  if (!image || !view) return;

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, view.x, view.y, map.width * view.scale, map.height * view.scale);

  const { xs, ys } = gridLines(grid, view, map, viewport);
  if (xs.length === 0 && ys.length === 0) return;
  // Lines snap to device pixels, so they stay one pixel thin at any zoom.
  const crisp = (at: number) => (Math.round(at * dpr) + 0.5) / dpr;
  const top = Math.max(0, view.y);
  const bottom = Math.min(viewport.height, view.y + map.height * view.scale);
  const left = Math.max(0, view.x);
  const right = Math.min(viewport.width, view.x + map.width * view.scale);
  context.beginPath();
  for (const x of xs) {
    const at = crisp(view.x + x * view.scale);
    context.moveTo(at, top);
    context.lineTo(at, bottom);
  }
  for (const y of ys) {
    const at = crisp(view.y + y * view.scale);
    context.moveTo(left, at);
    context.lineTo(right, at);
  }
  // A dark halo under a light line (or the reverse, in the light theme)
  // keeps the grid readable over any map, bright or dark.
  context.globalAlpha = 0.3;
  context.lineWidth = 3 / dpr + 1;
  context.strokeStyle = token(scene.themed, '--color-surface-secret');
  context.stroke();
  context.globalAlpha = 0.6;
  context.lineWidth = 1;
  context.strokeStyle = token(scene.themed, '--color-text-primary');
  context.stroke();
  context.globalAlpha = 1;
}
