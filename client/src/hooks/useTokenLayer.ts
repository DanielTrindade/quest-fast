import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { squaresBetween, type GridSettings, type TokenView } from '@quest-fast/shared';
import type { MapOverlay } from './useMapViewport';
import type { MapView, Size } from '../lib/map-view';
import { describeDrag, routeBetween, stopAtLimit } from '../lib/move-path';
import { drawReach, drawRoute, type RoutePoint } from '../lib/reach-draw';
import { LAND, REFUSE, SINK, createSpring, easeAcross, easeSettle, stepSpring, type Spring, type SpringConfig } from '../lib/spring';
import { drawTokens, type DrawnToken, type Dust } from '../lib/token-draw';
import { DRAG_THRESHOLD, restingPoint, screenRadius, toMapPoint, toScreenPoint, tokenAt } from '../lib/token-geometry';
import type { TokenMotionSource } from '../lib/token-motion';

type Point = { x: number; y: number };

/** How long a dropped token waits for the server's answer before going back. */
const DROP_WAIT_MS = 4000;
/** Picking a token up: `--duration-quick`, eased, never a spring (it happens all the time). */
const PICKUP_MS = 140;
/** The dust a landing raises: short, because a session has hundreds of them. */
const DUST_MS = 280;
/** A pointer still for longer than this before letting go has no speed left to throw with. */
const IDLE_RELEASE_MS = 80;
/** The fastest throw, in cells a second: past it a flick would fly off the map before landing. */
const MAX_THROW_CELLS = 20;
/** A slow frame (a background tab coming back) is stepped as this at most. */
const MAX_FRAME_SECONDS = 0.05;
/** After a move, its route reels in toward the token: where it came from, without leaving a mark. */
const TAPE_MS = 320;
/** Someone else's move: the route waits a moment, so it is seen before it reels in. */
const REMOTE_TAPE_DELAY_MS = 120;
/** Stopped at the limit: the part past it shrinks back to where the token stopped. */
const EXCESS_MS = 220;
/** The reach of a token only selected is fainter than while it is dragged. */
const IDLE_REACH = 0.55;
/** Past the map's edge the token resists, up to this far on screen. */
const RUBBER_MAX = 60;
/** A drop of our own waits this long for its save, so the save is not taken for someone else's move. */
const OWN_MOVE_MS = 10000;

export type TokenLayerOptions = {
  tokens: readonly TokenView[];
  grid: GridSettings;
  map: Size;
  viewerId: string | null;
  selectedId: string | null;
  onSelect?: (tokenId: string | null) => void;
  /** Whether the viewer may drag this token (the master any, a player their own). */
  canMove?: (token: TokenView) => boolean;
  /** The drag started: ask the server for the lock. */
  onGrab?: (tokenId: string) => void;
  /** The pointer moved the token, in map pixels; the screen throttles what it sends. */
  onDrag?: (tokenId: string, x: number, y: number) => void;
  /** Dropped where it will rest (on the grid, on the map). */
  onDrop?: (tokenId: string, x: number, y: number) => void;
  /** A started drag ended without a drop (a second finger made it a pinch): the token goes back. */
  onCancelDrag?: (tokenId: string) => void;
  /** Where the tokens others drag are, fed by the socket. */
  motion?: TokenMotionSource;
  /**
   * A move dropped but not confirmed yet: the token waits there, with the path
   * and the cost from where it is saved.
   */
  pendingMove?: { tokenId: string; x: number; y: number } | null;
  /**
   * Whether a drop of this token past the metres left stops on the last
   * square within them (a move that spends the turn). Otherwise it rests
   * where dropped: free, or for the master to move it anyway.
   */
  stopAtLimit?: (token: TokenView) => boolean;
};

type LayerWiring = {
  /** Where the map reads the layer from. */
  overlayRef: RefObject<MapOverlay | null>;
  requestDraw: () => void;
  /** The element whose theme colours the tokens. */
  themedRef: RefObject<Element | null>;
  /** Where the cost of the move being dragged is written, beside the token: the canvas has no text. */
  labelRef?: RefObject<HTMLElement | null>;
};

type Drag = {
  token: TokenView;
  start: Point;
  /** From the pointer to the token's centre, in map pixels: the token does not jump under the finger. */
  grip: Point;
  started: boolean;
  at: Point;
  /** When the token left the table, and how high it already was (caught mid-landing). */
  liftedAt: number;
  liftFrom: number;
  /** The pointer's speed, in map pixels a second, smoothed over the last moves. */
  velocity: Point;
  movedAt: number;
  /** Where the pointer would drop it, and where it stops instead when that is past the limit. */
  aim: { rest: Point; stop: Point | null };
};

/** A route reeling in after a move: `toward` the token at its end, or the start (the part past the limit). */
type Reel = { points: RoutePoint[]; toward: 'end' | 'start'; startsAt: number; duration: number };

/** A token released here, on its way to rest: the springs carry it, the pointer no longer does. */
type Settling = { x: Spring; y: Spring; lift: Spring; landing: boolean; size: TokenView['size'] };

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function settlingFrom(token: Pick<TokenView, 'size'>, at: Point, lift: number, config: SpringConfig, velocity: Point = { x: 0, y: 0 }): Settling {
  const settling: Settling = {
    x: createSpring(at.x, config), y: createSpring(at.y, config), lift: createSpring(lift, config), landing: false, size: token.size,
  };
  settling.x.velocity = velocity.x;
  settling.y.velocity = velocity.y;
  settling.lift.target = 0;
  return settling;
}

function liftOf(drag: Drag, now: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const progress = Math.min(1, (now - drag.liftedAt) / PICKUP_MS);
  return drag.liftFrom + (1 - drag.liftFrom) * easeSettle(progress);
}

/**
 * The tokens as a layer of the map canvas: draws them, picks the one under
 * the pointer, and turns a press on a movable token into a drag (the map pans
 * otherwise). A token someone else drags is drawn where the motion source puts
 * it; the one dragged here follows the pointer and, dropped, stays at its
 * resting point until the server's answer brings it there (or gives up).
 *
 * Only the gesture made here moves with physics: dropped, the token springs
 * onto its cell with the speed it was thrown at, sinks a little and raises
 * dust; refused, it goes back fast and with no bounce. With reduced motion it
 * simply appears where it rests.
 */
export function useTokenLayer(options: TokenLayerOptions & LayerWiring): { cancelDrag: (tokenId: string) => void } {
  const latest = useRef(options);
  const drag = useRef<Drag | null>(null);
  const drops = useRef(new Map<string, Point & { until: number }>());
  const settling = useRef(new Map<string, Settling>());
  const dust = useRef<(Dust & { startedAt: number })[]>([]);
  const lastFrame = useRef(0);
  const reels = useRef<Reel[]>([]);
  const savedAt = useRef(new Map<string, Point>());
  const ownMoves = useRef(new Map<string, number>());
  // The label's node, held here: the layer writes to it every frame, outside React.
  const labelNode = useRef<HTMLElement | null>(null);
  /** The label's text as last written, the frame width it was laid out in, and its size. */
  const labelBox = useRef({ text: '', frame: 0, width: 0, height: 0 });
  const images = useRef(new Map<string, HTMLImageElement>());
  const loading = useRef(new Set<string>());
  const { tokens, selectedId, viewerId, grid, map, motion, requestDraw, overlayRef, pendingMove } = options;

  useEffect(() => {
    latest.current = options;
    labelNode.current = options.labelRef?.current ?? null;
  });

  // The label is measured when its text changes, but it can grow after that:
  // the interface font may arrive later and widen it. Placed with the old
  // size, it would poke out of the map's edge, so its size follows it.
  const { labelRef } = options;
  useEffect(() => {
    const element = labelRef?.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      labelBox.current.width = element.offsetWidth;
      labelBox.current.height = element.offsetHeight;
      requestDraw();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [labelRef, requestDraw]);

  // Avatars load once each; a token draws its initials until its image is in.
  useEffect(() => {
    for (const token of tokens) {
      const url = token.avatarUrl;
      if (!url || images.current.has(url) || loading.current.has(url)) continue;
      loading.current.add(url);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        images.current.set(url, image);
        requestDraw();
      };
      image.src = url;
    }
  }, [tokens, requestDraw]);

  useEffect(() => motion?.subscribe(requestDraw), [motion, requestDraw]);

  // A token saved somewhere new that was not dropped here (someone else's move): its route reels in.
  useEffect(() => {
    const now = performance.now();
    const reducedMotion = prefersReducedMotion();
    const next = new Map<string, Point>();
    let reeling = false;
    for (const token of tokens) {
      next.set(token.id, { x: token.x, y: token.y });
      const before = savedAt.current.get(token.id);
      if (!before || (before.x === token.x && before.y === token.y)) continue;
      const own = ownMoves.current.get(token.id);
      ownMoves.current.delete(token.id);
      // One square is an arrow key's step: keyboard moves never animate.
      if ((own !== undefined && own > now) || reducedMotion || squaresBetween(before, token, grid) < 2) continue;
      const points = [{ ...before, over: false }, ...routeBetween(before, token, grid).map((step) => ({ x: step.x, y: step.y, over: false }))];
      reels.current.push({ points, toward: 'end', startsAt: now + REMOTE_TAPE_DELAY_MS, duration: TAPE_MS });
      reeling = true;
    }
    savedAt.current = next;
    if (reeling) requestDraw();
  }, [tokens, grid, requestDraw]);

  // What the canvas must show at once: drawn on the next frame.
  useEffect(() => {
    requestDraw();
  }, [tokens, selectedId, viewerId, grid, map.width, map.height, pendingMove, requestDraw]);

  // One layer for the component's life; it reads the props through `latest`.
  const overlay = useMemo<MapOverlay & { sendBack: (tokenId: string) => void }>(() => {
    /** Where a token rests now, before any spring: its drop, the move held for confirmation, someone's drag, or its save. */
    const restOf = (token: TokenView, now: number, reducedMotion: boolean): Point => {
      const current = latest.current;
      const pending = current.pendingMove?.tokenId === token.id ? current.pendingMove : null;
      if (pending) return { x: pending.x, y: pending.y };
      const dropped = drops.current.get(token.id);
      if (dropped && token.x === dropped.x && token.y === dropped.y) drops.current.delete(token.id);
      else if (dropped) return dropped;
      const moving = token.movingBy && token.movingBy.userId !== current.viewerId
        ? current.motion?.positionOf(token.id, now, { reducedMotion })
        : null;
      return moving ?? token;
    };

    const drawn = (now: number): DrawnToken[] => {
      const current = latest.current;
      const reducedMotion = prefersReducedMotion();
      // A drop whose token left the scene, or that waited too long, is over:
      // left behind it would keep the canvas drawing every frame.
      const present = new Set(current.tokens.map((token) => token.id));
      for (const [id, dropped] of drops.current) {
        if (!present.has(id) || now > dropped.until) drops.current.delete(id);
      }
      for (const id of settling.current.keys()) {
        if (!present.has(id)) settling.current.delete(id);
      }
      return current.tokens.map((token) => {
        const dragging = drag.current?.started && drag.current.token.id === token.id ? drag.current : null;
        if (dragging) {
          return { ...token, at: dragging.at, lift: liftOf(dragging, now, reducedMotion), ghost: dragging.aim.stop ?? dragging.aim.rest };
        }
        const rest = restOf(token, now, reducedMotion);
        const moving = settling.current.get(token.id);
        if (moving) {
          moving.x.target = rest.x;
          moving.y.target = rest.y;
          return { ...token, at: { x: moving.x.value, y: moving.y.value }, lift: moving.lift.value, ghost: null };
        }
        return { ...token, at: rest, lift: 0, ghost: null };
      });
    };

    /** Steps the springs and the dust to `now`; says whether anything is still moving. */
    const advance = (now: number): boolean => {
      const seconds = Math.min(MAX_FRAME_SECONDS, Math.max(0, now - lastFrame.current) / 1000);
      lastFrame.current = now;
      for (const [id, moving] of settling.current) {
        const before = moving.lift.value;
        const busy = [stepSpring(moving.x, seconds), stepSpring(moving.y, seconds), stepSpring(moving.lift, seconds)].some(Boolean);
        if (moving.landing && before > 0 && moving.lift.value <= 0) {
          moving.landing = false;
          dust.current.push({ at: { x: moving.x.target, y: moving.y.target }, size: moving.size, age: 0, startedAt: now });
        }
        if (!busy) settling.current.delete(id);
      }
      dust.current = dust.current
        .map((puff) => ({ ...puff, age: (now - puff.startedAt) / DUST_MS }))
        .filter((puff) => puff.age < 1);
      reels.current = reels.current.filter((reel) => now < reel.startsAt + reel.duration);
      const lifting = drag.current?.started === true && now - drag.current.liftedAt < PICKUP_MS;
      return settling.current.size > 0 || dust.current.length > 0 || reels.current.length > 0 || lifting;
    };

    /** A route square by square, in the danger tone past the metres left. */
    const routePoints = (from: Point, to: Point, metersLeft: number): RoutePoint[] => [
      { ...from, over: false },
      ...routeBetween(from, to, latest.current.grid).map((step) => ({ x: step.x, y: step.y, over: step.meters > metersLeft + 1e-6 })),
    ];

    /** Where a drag at `at` would drop the token, and where it stops when that is past the limit. */
    const aimOf = (token: TokenView, at: Point): Drag['aim'] => {
      const current = latest.current;
      const rest = restingPoint(at, current.grid, token.size, current.map);
      const stop = token.reach && current.stopAtLimit?.(token) ? stopAtLimit(token, rest, current.grid, token.reach.left) : null;
      return { rest, stop };
    };

    /** The label beside the dragged token: written only when it changes, placed every frame. */
    const placeLabel = (view: MapView, token: DrawnToken | undefined, dragging: Drag | null) => {
      const element = labelNode.current;
      const label = labelBox.current;
      if (!element) return;
      if (!dragging || !token?.reach || !token.ghost) {
        if (!element.hidden) element.hidden = true;
        label.text = '';
        return;
      }
      const { grid } = latest.current;
      const text = describeDrag(token, dragging.aim.rest, grid, token.reach.left, dragging.aim.stop);
      const over = !dragging.aim.stop && text.includes('além');
      const frame = element.parentElement;
      const frameWidth = frame?.clientWidth ?? 0;
      if (text !== label.text || frameWidth !== label.frame) {
        element.textContent = text;
        element.dataset.over = String(over);
        element.hidden = false;
        label.text = text;
        label.frame = frameWidth;
        label.width = element.offsetWidth;
        label.height = element.offsetHeight;
      }
      const centre = toScreenPoint(view, token.ghost);
      const radius = screenRadius(token.size, grid.cellSize, view.scale);
      const frameHeight = frame?.clientHeight ?? 0;
      const x = Math.max(4, Math.min(frameWidth - label.width - 4, centre.x - label.width / 2));
      const below = centre.y + radius + 8;
      // Near the bottom it goes above the token, so the whole of it stays in the frame.
      const y = below + label.height <= frameHeight - 4 ? below : Math.max(4, centre.y - radius - 8 - label.height);
      element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };

    /**
     * Under the tokens: the area the token in focus can still reach (the one
     * dragged, the one waiting for confirmation, else the selected one), then
     * the route of a move on its way, and the routes reeling in after a move.
     */
    const drawMoving = (context: CanvasRenderingContext2D, view: MapView, themed: Element, tokens: readonly DrawnToken[], now: number) => {
      const current = latest.current;
      const dragging = drag.current?.started ? drag.current : null;
      const focusId = dragging?.token.id ?? current.pendingMove?.tokenId ?? current.selectedId;
      const token = tokens.find((candidate) => candidate.id === focusId);
      if (token?.reach) {
        const saved = { x: token.x, y: token.y };
        const lifted = dragging ? (prefersReducedMotion() ? 1 : easeSettle(Math.min(1, (now - dragging.liftedAt) / PICKUP_MS))) : 0;
        drawReach(context, {
          token: { ...saved, size: token.size }, meters: token.reach.left, cellSize: current.grid.cellSize, map: current.map, view, themed,
          alpha: IDLE_REACH + (1 - IDLE_REACH) * lifted,
        });
        const target = dragging ? dragging.aim.rest : current.pendingMove?.tokenId === token.id ? token.at : null;
        if (target) drawRoute(context, { points: routePoints(saved, target, token.reach.left), view, themed });
      }
      placeLabel(view, token, dragging);
      for (const reel of reels.current) {
        const progress = easeAcross(Math.min(1, Math.max(0, (now - reel.startsAt) / reel.duration)));
        drawRoute(context, { points: reel.points, view, themed, visible: reel.toward === 'end' ? [progress, 1] : [0, 1 - progress] });
      }
    };

    /** The token flies back to where it rests now, fast and with no bounce. */
    const sendBack = (tokenId: string, from: DrawnToken | undefined) => {
      if (!from || prefersReducedMotion()) {
        settling.current.delete(tokenId);
        return;
      }
      settling.current.set(tokenId, settlingFrom(from, from.at, from.lift, REFUSE));
      lastFrame.current = performance.now();
    };

    return {
      draw(context, view: MapView, now) {
        const current = latest.current;
        const themed = current.themedRef.current ?? context.canvas;
        const animating = advance(now);
        const tokens = drawn(now);
        drawMoving(context, view, themed, tokens, now);
        drawTokens(context, {
          tokens,
          view,
          cellSize: current.grid.cellSize,
          selectedId: current.selectedId,
          viewerId: current.viewerId,
          images: images.current,
          themed,
          dust: dust.current,
        });
        return animating || (current.motion?.animating(now) ?? false) || drops.current.size > 0;
      },

      pointerDown(point, view) {
        const current = latest.current;
        // Hit where the token is drawn: mid-drag by someone else, landing, or waiting for the server after a drop.
        const hit = tokenAt(drawn(performance.now()), point, view, current.grid.cellSize, (token) => token.at);
        if (!hit) return false;
        current.onSelect?.(hit.id);
        if (!current.canMove?.(hit)) return false;
        const pressed = toMapPoint(view, point);
        drag.current = {
          token: hit, start: point, grip: { x: hit.at.x - pressed.x, y: hit.at.y - pressed.y }, started: false, at: hit.at,
          liftedAt: 0, liftFrom: Math.max(0, hit.lift), velocity: { x: 0, y: 0 }, movedAt: 0, aim: { rest: hit.at, stop: null },
        };
        return true;
      },

      pointerMove(point, view) {
        const current = latest.current;
        const active = drag.current;
        if (!active) return;
        const now = performance.now();
        if (!active.started) {
          if (Math.hypot(point.x - active.start.x, point.y - active.start.y) < DRAG_THRESHOLD) return;
          active.started = true;
          active.liftedAt = now;
          active.movedAt = now;
          // Caught mid-landing: the pointer takes it from the springs.
          settling.current.delete(active.token.id);
          current.onGrab?.(active.token.id);
        }
        const pointer = toMapPoint(view, point);
        // Past the edge it resists instead of stopping dead: a hard stop reads as the map freezing.
        const rubber = (over: number) => ((1 - 1 / ((over * view.scale * 0.55) / RUBBER_MAX + 1)) * RUBBER_MAX) / view.scale;
        const band = (value: number, max: number) => (value < 0 ? -rubber(-value) : value > max ? max + rubber(value - max) : value);
        const at = { x: band(pointer.x + active.grip.x, current.map.width), y: band(pointer.y + active.grip.y, current.map.height) };
        const seconds = Math.max(1, now - active.movedAt) / 1000;
        active.velocity = {
          x: active.velocity.x * 0.6 + ((at.x - active.at.x) / seconds) * 0.4,
          y: active.velocity.y * 0.6 + ((at.y - active.at.y) / seconds) * 0.4,
        };
        active.movedAt = now;
        active.at = at;
        active.aim = aimOf(active.token, at);
        current.onDrag?.(active.token.id, at.x, at.y);
        current.requestDraw();
      },

      pointerUp() {
        const current = latest.current;
        const active = drag.current;
        drag.current = null;
        // A token removed mid-drag has nowhere to drop.
        if (!active?.started || !current.tokens.some((token) => token.id === active.token.id)) return;
        const aim = aimOf(active.token, active.at);
        const rest = aim.stop ?? aim.rest;
        const now = performance.now();
        drops.current.set(active.token.id, { ...rest, until: now + DROP_WAIT_MS });
        ownMoves.current.set(active.token.id, now + OWN_MOVE_MS);
        const { reach } = active.token;
        if (!prefersReducedMotion() && reach) {
          reels.current.push({ points: routePoints({ x: active.token.x, y: active.token.y }, rest, Number.POSITIVE_INFINITY), toward: 'end', startsAt: now, duration: TAPE_MS });
          if (aim.stop) {
            reels.current.push({ points: routePoints(aim.stop, aim.rest, Number.NEGATIVE_INFINITY), toward: 'start', startsAt: now, duration: EXCESS_MS });
          }
        }
        if (!prefersReducedMotion()) {
          const max = current.grid.cellSize * MAX_THROW_CELLS;
          const speed = Math.hypot(active.velocity.x, active.velocity.y);
          // Held still before letting go: placed, not thrown.
          const throwScale = now - active.movedAt > IDLE_RELEASE_MS ? 0 : Math.min(1, max / (speed || 1));
          const landing = settlingFrom(active.token, active.at, liftOf(active, now, false), LAND, {
            x: active.velocity.x * throwScale,
            y: active.velocity.y * throwScale,
          });
          landing.lift.stiffness = SINK.stiffness;
          landing.lift.damping = SINK.damping;
          landing.landing = true;
          settling.current.set(active.token.id, landing);
          lastFrame.current = now;
        }
        current.onDrop?.(active.token.id, rest.x, rest.y);
        current.requestDraw();
      },

      cancel() {
        const current = latest.current;
        const active = drag.current;
        drag.current = null;
        if (active?.started) {
          const now = performance.now();
          sendBack(active.token.id, { ...active.token, at: active.at, lift: liftOf(active, now, prefersReducedMotion()), ghost: null });
          current.onCancelDrag?.(active.token.id);
        }
        current.requestDraw();
      },

      sendBack(tokenId: string) {
        // From where it is drawn now: in the hand, landing, or waiting on its drop.
        const from = drawn(performance.now()).find((token) => token.id === tokenId);
        if (drag.current?.token.id === tokenId) drag.current = null;
        drops.current.delete(tokenId);
        ownMoves.current.delete(tokenId);
        sendBack(tokenId, from);
      },
    };
  }, []);

  useEffect(() => {
    overlayRef.current = overlay;
    requestDraw();
    return () => {
      overlayRef.current = null;
    };
  }, [overlayRef, overlay, requestDraw]);

  /**
   * The server said no (someone else holds it, or the drop failed): the token
   * goes back to its saved place now, the pointer still down or not. What is
   * left of the gesture neither moves it nor pans the map.
   */
  const cancelDrag = useCallback((tokenId: string) => {
    overlay.sendBack(tokenId);
    requestDraw();
  }, [overlay, requestDraw]);

  return { cancelDrag };
}
