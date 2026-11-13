import type { TokenKind, TokenView } from '@quest-fast/shared';
import type { MapView } from './map-view';
import { screenRadius, toScreenPoint } from './token-geometry';

type Point = { x: number; y: number };

/** A token where it is drawn this frame, which may differ from where it is saved. */
export type DrawnToken = TokenView & {
  at: Point;
  /** Being dragged here: drawn lifted, with the cell it will rest on. */
  lifted: boolean;
  /** Where a lifted token will rest when dropped. */
  ghost: Point | null;
};

/** Below this radius on screen there is no room for initials. */
const MIN_INITIALS_RADIUS = 9;
/** Below this radius the "being moved by" label would cover more than the token. */
const MIN_LABEL_RADIUS = 8;

/** The theme's values the canvas needs: it cannot read a CSS variable itself. */
function palette(themed: Element) {
  const style = getComputedStyle(themed);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    rings: {
      character: read('--color-accent'),
      combatant: read('--color-danger'),
      free: read('--color-border-strong'),
    } satisfies Record<TokenKind, string>,
    // Source tokens only: an `@theme inline` alias (card, border) holds the
    // root's value, which would ignore a themed section's colours.
    disc: read('--color-surface-raised'),
    text: read('--color-text-primary'),
    halo: read('--color-surface-secret'),
    focus: read('--color-focus-ring'),
    border: read('--color-border-subtle'),
    shadow: read('--color-scrim'),
    font: read('--font-sans') || 'sans-serif',
  };
}

type Palette = ReturnType<typeof palette>;

function ring(context: CanvasRenderingContext2D, centre: Point, radius: number, colour: string, width: number, dashed: boolean) {
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.setLineDash(dashed ? [Math.max(3, radius * 0.35), Math.max(2, radius * 0.2)] : []);
  context.lineWidth = width;
  context.strokeStyle = colour;
  context.stroke();
  context.setLineDash([]);
}

function face(context: CanvasRenderingContext2D, token: DrawnToken, centre: Point, radius: number, image: HTMLImageElement | undefined, colours: Palette) {
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.fillStyle = colours.disc;
  context.fill();
  if (image) {
    // Cover the disc, keeping the face (the image's upper part) in view, as `Avatar` does.
    context.save();
    context.clip();
    const side = radius * 2;
    const scale = Math.max(side / image.naturalWidth, side / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, centre.x - width / 2, centre.y - radius - (height - side) * 0.2, width, height);
    context.restore();
    return;
  }
  if (radius < MIN_INITIALS_RADIUS) return;
  context.fillStyle = colours.text;
  context.font = `600 ${Math.round(radius * (token.initials.length > 1 ? 0.75 : 0.95))}px ${colours.font}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(token.initials, centre.x, centre.y + radius * 0.04);
}

function movingLabel(context: CanvasRenderingContext2D, name: string, centre: Point, radius: number, colours: Palette) {
  const size = 12;
  context.font = `500 ${size}px ${colours.font}`;
  const width = context.measureText(name).width + 12;
  const height = size + 8;
  const x = centre.x - width / 2;
  const y = centre.y + radius + 6;
  context.beginPath();
  context.roundRect(x, y, width, height, height / 2);
  context.fillStyle = colours.disc;
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = colours.border;
  context.stroke();
  context.fillStyle = colours.text;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name, centre.x, y + height / 2 + 0.5);
}

/**
 * Draws the tokens over the map, in order (the last on top). Each is a disc
 * with the avatar or the initials and a ring in its origin's tone: character,
 * combatant or free. A hidden token (only the master gets one) has a dashed,
 * faded ring. The selected one has the focus ring around it. One someone else
 * is moving carries their name; the one being dragged here is lifted, with a
 * dashed outline on the cell it will rest on.
 */
export function drawTokens(context: CanvasRenderingContext2D, scene: {
  tokens: readonly DrawnToken[];
  view: MapView;
  cellSize: number;
  selectedId: string | null;
  /** Who is looking: their own drag needs no name on it. */
  viewerId: string | null;
  images: ReadonlyMap<string, HTMLImageElement>;
  themed: Element;
}) {
  const { tokens, view, cellSize, selectedId, viewerId, images } = scene;
  if (tokens.length === 0) return;
  const colours = palette(scene.themed);

  for (const token of tokens) {
    const radius = screenRadius(token.size, cellSize, view.scale);
    const centre = toScreenPoint(view, token.at);
    const ringWidth = Math.max(2, Math.min(5, radius * 0.12));

    if (token.ghost) {
      const ghost = toScreenPoint(view, token.ghost);
      context.globalAlpha = 0.9;
      ring(context, ghost, radius, colours.focus, 2, true);
      context.globalAlpha = 1;
    }

    context.save();
    context.globalAlpha = token.hidden ? 0.55 : 1;
    if (token.lifted) {
      context.shadowColor = colours.shadow;
      context.shadowBlur = 14;
      context.shadowOffsetY = 6;
    }
    face(context, token, centre, radius, token.avatarUrl ? images.get(token.avatarUrl) : undefined, colours);
    context.restore();

    context.globalAlpha = token.hidden ? 0.75 : 1;
    // A dark halo under the ring keeps it readable over any map, as the grid's does.
    ring(context, centre, radius, colours.halo, ringWidth + 2, false);
    ring(context, centre, radius - 0.5, colours.rings[token.kind], ringWidth, token.hidden);
    context.globalAlpha = 1;

    if (token.id === selectedId) ring(context, centre, radius + ringWidth + 3, colours.focus, 3, false);
    if (token.movingBy && token.movingBy.userId !== viewerId && radius >= MIN_LABEL_RADIUS) {
      movingLabel(context, token.movingBy.name, centre, radius, colours);
    }
  }
}
