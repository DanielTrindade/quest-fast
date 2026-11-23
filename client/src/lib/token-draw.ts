import type { TokenKind, TokenView } from '@quest-fast/shared';
import type { MapView } from './map-view';
import type { FightMarks, TokenHealth } from './token-combat';
import { inPaintOrder, screenRadius, toScreenPoint } from './token-geometry';
import { SHAPE, darken, detailLevel, lighten, liftScale, metalOf, shapeVertices, type MedallionShape } from './token-medallion';

type Point = { x: number; y: number };

/** A token where it is drawn this frame, which may differ from where it is saved. */
export type DrawnToken = TokenView & {
  at: Point;
  /**
   * How high it is off the table: 0 resting, 1 held by the pointer here,
   * below 0 for a moment while it lands.
   */
  lift: number;
  /** Where a token dragged here will rest when dropped. */
  ghost: Point | null;
};

/** The puff of dust a dropped token raises where it lands, `age` from 0 to 1. */
export type Dust = { at: Point; size: TokenView['size']; age: number };

/** Below this radius on screen the face has no room for initials. */
const MIN_INITIALS_RADIUS = 7;
/** Below this radius the "being moved by" label would cover more than the token. */
const MIN_LABEL_RADIUS = 8;

/** The theme's values the canvas needs: it cannot read a CSS variable itself. */
function palette(themed: Element, context: CanvasRenderingContext2D) {
  const style = getComputedStyle(themed);
  // The canvas normalises any opaque colour to `#rrggbb`, which the metal mixes from.
  const read = (name: string) => {
    context.save();
    context.fillStyle = style.getPropertyValue(name).trim();
    const normalised = String(context.fillStyle);
    context.restore();
    return normalised;
  };
  const control = read('--color-border-control');
  return {
    enamel: {
      character: read('--color-accent'),
      combatant: read('--color-danger'),
      free: darken(control, 0.15),
    } satisfies Record<TokenKind, string>,
    control,
    gem: read('--color-accent'),
    down: read('--color-danger'),
    health: {
      unhurt: read('--color-success'),
      wounded: read('--color-text-secondary'),
      bloodied: read('--color-danger'),
    } satisfies Record<TokenHealth['band'], string>,
    turn: read('--color-accent-text'),
    dust: lighten(control, 0.6),
    // Source tokens only: an `@theme inline` alias (card, border) holds the
    // root's value, which would ignore a themed section's colours.
    disc: read('--color-surface-raised'),
    text: read('--color-text-primary'),
    halo: read('--color-surface-secret'),
    focus: read('--color-focus-ring'),
    border: read('--color-border-subtle'),
    shadow: style.getPropertyValue('--color-scrim').trim(),
    font: style.getPropertyValue('--font-sans').trim() || 'sans-serif',
  };
}

type Palette = ReturnType<typeof palette>;

function traceShape(context: CanvasRenderingContext2D, shape: MedallionShape, centre: Point, radius: number) {
  context.beginPath();
  const vertices = shapeVertices(shape, radius);
  if (!vertices) {
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    return;
  }
  vertices.forEach((vertex, index) => {
    if (index === 0) context.moveTo(centre.x + vertex.x, centre.y + vertex.y);
    else context.lineTo(centre.x + vertex.x, centre.y + vertex.y);
  });
  context.closePath();
}

function dots(context: CanvasRenderingContext2D, count: number, start: number, distance: number, size: number) {
  for (let index = 0; index < count; index += 1) {
    const angle = start + (index / count) * Math.PI * 2;
    context.beginPath();
    context.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, size, 0, Math.PI * 2);
    context.fill();
  }
}

function face(context: CanvasRenderingContext2D, token: DrawnToken, radius: number, image: HTMLImageElement | undefined, colours: Palette) {
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
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
    context.drawImage(image, -width / 2, -radius - (height - side) * 0.2, width, height);
    context.restore();
    return;
  }
  if (radius < MIN_INITIALS_RADIUS) return;
  context.fillStyle = colours.text;
  context.font = `600 ${Math.round(radius * (token.initials.length > 1 ? 0.78 : 1))}px ${colours.font}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(token.initials, 0, radius * 0.06);
}

/** A defeated creature: an X across the disc, over a halo so it reads on any face. */
function cross(context: CanvasRenderingContext2D, centre: Point, radius: number, colours: Palette) {
  const reach = radius * 0.55;
  context.beginPath();
  context.moveTo(centre.x - reach, centre.y - reach);
  context.lineTo(centre.x + reach, centre.y + reach);
  context.moveTo(centre.x + reach, centre.y - reach);
  context.lineTo(centre.x - reach, centre.y + reach);
  context.lineCap = 'round';
  context.lineWidth = Math.max(3, radius * 0.22);
  context.strokeStyle = colours.halo;
  context.stroke();
  context.lineWidth = Math.max(2, radius * 0.12);
  context.strokeStyle = colours.text;
  context.stroke();
  context.lineCap = 'butt';
}

// A display name runs up to 32 characters; whole, it covers the neighbouring tokens.
const MOVING_LABEL_MAX = 120;

function fitLabel(context: CanvasRenderingContext2D, text: string, max: number): string {
  if (context.measureText(text).width <= max) return text;
  const characters = [...text];
  while (characters.length > 1 && context.measureText(`${characters.join('').trimEnd()}…`).width > max) characters.pop();
  return `${characters.join('').trimEnd()}…`;
}

function movingLabel(context: CanvasRenderingContext2D, name: string, centre: Point, radius: number, colours: Palette) {
  const size = 12;
  context.font = `500 ${size}px ${colours.font}`;
  const label = fitLabel(context, name, MOVING_LABEL_MAX);
  const width = context.measureText(label).width + 12;
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
  context.fillText(label, centre.x, y + height / 2 + 0.5);
}

/** Outside the piece, inside the selection ring. */
const HEALTH_GAP = 2;
/** Outside the selection ring, which runs 5 px off the piece. */
const TURN_GAP = 10;

/**
 * The health arc around a combatant's piece: a track in the halo's tone and,
 * from the top clockwise, the part left in the band's colour. A glance only:
 * the list and the panel beside the map say it in words.
 */
function healthArc(context: CanvasRenderingContext2D, health: TokenHealth, centre: Point, radius: number, colours: Palette) {
  const ring = radius + HEALTH_GAP + 1.5;
  const width = Math.max(2.5, radius * 0.07);
  context.save();
  context.lineCap = 'round';
  context.beginPath();
  context.arc(centre.x, centre.y, ring, 0, Math.PI * 2);
  context.lineWidth = width + 2;
  context.strokeStyle = colours.halo;
  context.stroke();
  if (health.fraction > 0) {
    const start = -Math.PI / 2;
    context.beginPath();
    context.arc(centre.x, centre.y, ring, start, start + Math.PI * 2 * health.fraction);
    context.lineWidth = width;
    context.strokeStyle = colours.health[health.band];
    context.stroke();
  }
  context.restore();
}

/**
 * Whose turn it is: a solid ring around the piece, past the selection ring,
 * and a notch above it pointing down, so it reads even where tokens crowd.
 */
function turnMarker(context: CanvasRenderingContext2D, centre: Point, radius: number, colours: Palette) {
  const ring = radius + TURN_GAP;
  context.save();
  context.beginPath();
  context.arc(centre.x, centre.y, ring, 0, Math.PI * 2);
  context.lineWidth = 4.5;
  context.strokeStyle = colours.halo;
  context.stroke();
  context.lineWidth = 2.5;
  context.strokeStyle = colours.turn;
  context.stroke();
  const size = Math.max(5, Math.min(9, radius * 0.3));
  const tip = centre.y - ring - 2;
  context.beginPath();
  context.moveTo(centre.x, tip);
  context.lineTo(centre.x - size, tip - size * 1.2);
  context.lineTo(centre.x + size, tip - size * 1.2);
  context.closePath();
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = colours.halo;
  context.stroke();
  context.fillStyle = colours.turn;
  context.fill();
  context.restore();
}

const ORIGIN: Point = { x: 0, y: 0 };

/**
 * One token as a table piece: a matte metal silhouette in its origin's shape,
 * a band in its origin's colour, the face (avatar or initials) in the middle.
 * The detail drops with the size on screen. `lift` raises it (a larger,
 * softer shadow) or, below 0, sinks it as it lands.
 */
function medallion(context: CanvasRenderingContext2D, token: DrawnToken, centre: Point, baseRadius: number, image: HTMLImageElement | undefined, colours: Palette) {
  const defeated = token.vitality === 'defeated';
  const down = token.vitality === 'down';
  const shape = SHAPE[token.kind];
  const metal = defeated ? colours.control : metalOf(token.kind, colours.control);
  const enamel = defeated ? colours.control : down ? colours.down : colours.enamel[token.kind];
  const radius = baseRadius * liftScale(token.lift);
  const height = Math.max(0, token.lift);
  const detail = detailLevel(radius);

  context.save();
  context.globalAlpha = token.hidden ? 0.55 : defeated ? 0.75 : 1;
  context.save();
  // The halo under the piece keeps its edge readable over any map, as the grid's does.
  context.shadowColor = colours.shadow;
  context.shadowBlur = 3 + height * 10;
  context.shadowOffsetY = 2 + height * radius * 0.18;
  traceShape(context, shape, centre, radius + 1);
  context.fillStyle = colours.halo;
  context.fill();
  context.restore();

  context.translate(centre.x, centre.y);
  if (defeated) context.filter = 'grayscale(1)';
  // A short dark lip under the metal: the same base the buttons stand on.
  traceShape(context, shape, { x: 0, y: Math.max(1, radius * 0.04) }, radius);
  context.fillStyle = darken(metal, 0.45);
  context.fill();
  traceShape(context, shape, ORIGIN, radius);
  const sheen = context.createLinearGradient(0, -radius, 0, radius);
  sheen.addColorStop(0, lighten(metal, 0.16));
  sheen.addColorStop(0.5, metal);
  sheen.addColorStop(1, darken(metal, 0.18));
  context.fillStyle = sheen;
  context.fill();

  const studSize = Math.max(1, radius * 0.045);
  if (token.kind === 'character' && detail >= 1) {
    context.fillStyle = lighten(metal, 0.22);
    dots(context, Math.round(radius * (detail === 2 ? 0.75 : 0.5)), 0, radius * 0.9, Math.max(1.1, studSize));
  }
  context.fillStyle = darken(metal, 0.35);
  if (token.kind === 'combatant' && detail === 2) dots(context, 4, Math.PI / 4, radius * 0.8, studSize);
  if (token.kind === 'free' && detail >= 1) dots(context, 8, Math.PI / 8, radius * 0.86, studSize);

  const bandInner = radius * 0.64;
  if (detail >= 1) {
    const bandOuter = radius * (token.kind === 'combatant' ? 0.78 : 0.82);
    context.beginPath();
    context.arc(0, 0, bandOuter, 0, Math.PI * 2);
    context.arc(0, 0, bandInner, 0, Math.PI * 2, true);
    const glaze = context.createLinearGradient(0, -bandOuter, 0, bandOuter);
    glaze.addColorStop(0, lighten(enamel, 0.1));
    glaze.addColorStop(1, darken(enamel, 0.15));
    context.fillStyle = glaze;
    context.fill();
    context.beginPath();
    context.arc(0, 0, bandOuter, 0, Math.PI * 2);
    context.lineWidth = Math.max(1, radius * 0.025);
    context.strokeStyle = darken(enamel, 0.5);
    context.stroke();
  }
  const faceRadius = detail >= 1 ? bandInner * 0.94 : radius * 0.78;
  context.beginPath();
  context.arc(0, 0, faceRadius + 1, 0, Math.PI * 2);
  context.lineWidth = Math.max(1.5, radius * 0.03);
  context.strokeStyle = lighten(metal, 0.35);
  context.stroke();
  context.save();
  if (down) context.filter = 'saturate(0.3) brightness(0.85)';
  face(context, token, faceRadius, image, colours);
  context.restore();

  if (token.kind === 'character' && detail >= 1 && token.vitality === 'up') {
    const gem = Math.max(2.5, radius * 0.13);
    context.beginPath();
    context.ellipse(0, -radius * 0.9, gem, gem * 0.82, 0, 0, Math.PI * 2);
    context.fillStyle = colours.gem;
    context.fill();
    context.lineWidth = Math.max(1, gem * 0.22);
    context.strokeStyle = darken(colours.gem, 0.4);
    context.stroke();
  }
  if (defeated) {
    context.filter = 'none';
    cross(context, ORIGIN, faceRadius, colours);
  }
  if (token.hidden) {
    traceShape(context, shape, ORIGIN, radius);
    context.setLineDash([Math.max(3, radius * 0.25), Math.max(2, radius * 0.16)]);
    context.lineWidth = 2;
    context.strokeStyle = colours.text;
    context.stroke();
    context.setLineDash([]);
  }
  context.restore();
}

function dust(context: CanvasRenderingContext2D, puff: Dust, centre: Point, radius: number, colours: Palette) {
  const spread = 1 - (1 - puff.age) ** 3;
  context.save();
  context.globalAlpha = (1 - puff.age) * 0.4;
  context.beginPath();
  context.arc(centre.x, centre.y, radius * (1 + spread * 0.35), 0, Math.PI * 2);
  context.lineWidth = 2;
  context.strokeStyle = colours.dust;
  context.stroke();
  context.fillStyle = colours.dust;
  const reach = radius * (1.05 + spread * 0.45);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 12;
    context.beginPath();
    context.arc(centre.x + Math.cos(angle) * reach, centre.y + Math.sin(angle) * reach * 0.9, 1.8 * (1 - puff.age) + 0.4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

/**
 * Draws the tokens over the map, in order (the last on top): each a table
 * piece whose silhouette and band tell its origin (character, combatant or
 * free). A hidden token (only the master gets one) is faded with a dashed
 * outline. The selected one has the focus outline around it, in its shape.
 * One someone else is moving carries their name; the one being dragged here
 * is raised, with a dashed outline on the cell it will rest on, and raises
 * dust where it lands. A defeated creature is grey and crossed out, under
 * the living; a character down has the band in the danger tone, still where
 * it was: someone to help. In a fight, an arc around each combatant's piece
 * shows the health it has left, and a ring with a notch above marks whose
 * turn it is.
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
  dust?: readonly Dust[];
  /** The running fight's turn and health, by token id. */
  marks?: FightMarks;
}) {
  const { tokens, view, cellSize, selectedId, viewerId, images, marks } = scene;
  if (tokens.length === 0) return;
  const colours = palette(scene.themed, context);

  for (const puff of scene.dust ?? []) {
    dust(context, puff, toScreenPoint(view, puff.at), screenRadius(puff.size, cellSize, view.scale), colours);
  }

  // The one in the air passes over the rest.
  const painted = inPaintOrder(tokens).sort((first, second) => Number(first.lift > 0) - Number(second.lift > 0));
  for (const token of painted) {
    const baseRadius = screenRadius(token.size, cellSize, view.scale);
    const centre = toScreenPoint(view, token.at);
    const shape = SHAPE[token.kind];

    if (token.ghost) {
      context.globalAlpha = 0.9;
      traceShape(context, shape, toScreenPoint(view, token.ghost), baseRadius);
      context.setLineDash([Math.max(3, baseRadius * 0.35), Math.max(2, baseRadius * 0.2)]);
      context.lineWidth = 2;
      context.strokeStyle = colours.focus;
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 1;
    }

    medallion(context, token, centre, baseRadius, token.avatarUrl ? images.get(token.avatarUrl) : undefined, colours);
    const mark = marks?.get(token.id);
    // A hidden token's marks fade with it: the table does not see them either.
    context.globalAlpha = token.hidden ? 0.55 : 1;
    if (mark?.health && token.vitality === 'up') healthArc(context, mark.health, centre, baseRadius * liftScale(token.lift), colours);
    if (mark?.turn) turnMarker(context, centre, baseRadius * liftScale(token.lift), colours);
    context.globalAlpha = 1;

    if (token.id === selectedId) {
      traceShape(context, shape, centre, baseRadius * liftScale(token.lift) + 5);
      context.lineWidth = 3;
      context.lineJoin = 'round';
      context.strokeStyle = colours.focus;
      context.stroke();
      context.lineJoin = 'miter';
    }
    if (token.movingBy && token.movingBy.userId !== viewerId && baseRadius >= MIN_LABEL_RADIUS) {
      movingLabel(context, token.movingBy.name, centre, baseRadius, colours);
    }
  }
}
