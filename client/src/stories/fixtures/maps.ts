import type { GridSettings, SceneSummary } from '@quest-fast/shared';

/**
 * A battle map drawn in code for the stories: never a map from the table,
 * whose images have rights of their own. It has a grid printed on it (cells
 * of `PRINTED_CELL` px starting at `PRINTED_OFFSET`), so the grid settings
 * can be shown matching it. Colours come from the theme's tokens.
 */
export const SYNTHETIC_MAP = { width: 1800, height: 1200 } as const;
export const PRINTED_CELL = 60;
export const PRINTED_OFFSET = 24;

let cached: string | null = null;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Deterministic, so every run draws the same map. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function syntheticMapUrl(): string {
  if (cached) return cached;
  const { width, height } = SYNTHETIC_MAP;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const next = random(7);

  // Ground and grass.
  context.fillStyle = token('--color-surface-raised');
  context.fillRect(0, 0, width, height);
  context.fillStyle = token('--color-success');
  for (let index = 0; index < 90; index += 1) {
    context.globalAlpha = 0.08 + next() * 0.12;
    context.beginPath();
    context.arc(next() * width, next() * height, 40 + next() * 140, 0, Math.PI * 2);
    context.fill();
  }

  // A river across the map.
  context.globalAlpha = 0.55;
  context.strokeStyle = token('--color-accent');
  context.lineWidth = 70;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-40, 260);
  context.bezierCurveTo(500, 120, 700, 820, 1200, 700);
  context.bezierCurveTo(1500, 620, 1650, 980, 1860, 1100);
  context.stroke();

  // A ruined hall with two rooms.
  context.globalAlpha = 1;
  context.fillStyle = token('--color-surface-overlay');
  context.strokeStyle = token('--color-border-strong');
  context.lineWidth = 14;
  for (const [x, y, w, h] of [[PRINTED_OFFSET + 60 * 15, PRINTED_OFFSET + 60 * 2, 60 * 8, 60 * 6], [PRINTED_OFFSET + 60 * 23, PRINTED_OFFSET + 60 * 4, 60 * 4, 60 * 4]]) {
    context.fillRect(x, y, w, h);
    context.strokeRect(x, y, w, h);
  }

  // Trees.
  context.fillStyle = token('--color-success');
  for (let index = 0; index < 40; index += 1) {
    context.globalAlpha = 0.7;
    context.beginPath();
    context.arc(next() * 700, 600 + next() * 600, 18 + next() * 22, 0, Math.PI * 2);
    context.fill();
  }

  // The grid printed on the image, as on the table's maps.
  context.globalAlpha = 0.35;
  context.strokeStyle = token('--color-text-muted');
  context.lineWidth = 2;
  context.beginPath();
  for (let x = PRINTED_OFFSET; x <= width; x += PRINTED_CELL) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = PRINTED_OFFSET; y <= height; y += PRINTED_CELL) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  cached = canvas.toDataURL('image/jpeg', 0.85);
  return cached;
}

/** The grid the server gives a new scene: 30 cells across, no offset. */
export const defaultSceneGrid: GridSettings = {
  enabled: true, cellSize: SYNTHETIC_MAP.width / 30, offsetX: 0, offsetY: 0, snap: true,
};

/** The grid matching the one printed on the synthetic map. */
export const alignedSceneGrid: GridSettings = {
  enabled: true, cellSize: PRINTED_CELL, offsetX: PRINTED_OFFSET, offsetY: PRINTED_OFFSET, snap: true,
};

export function sceneList(mapUrl: string): SceneSummary[] {
  return [
    { id: 's-hall', name: 'Salão em ruínas', mapUrl, mapWidth: 1800, mapHeight: 1200, active: true, createdAt: '2026-11-12T21:00:00.000Z' },
    { id: 's-road', name: 'Estrada de Triboar', mapUrl, mapWidth: 4096, mapHeight: 2731, active: false, createdAt: '2026-11-10T21:00:00.000Z' },
    {
      id: 's-long',
      name: 'Covil do dragão verde sob as Colinas do Crepúsculo, terceiro nível',
      mapUrl, mapWidth: 2048, mapHeight: 4096, active: false, createdAt: '2026-11-01T21:00:00.000Z',
    },
  ];
}
