import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { GridSettings, TokenView } from '@quest-fast/shared';
import type { MapOverlay } from './useMapViewport';
import type { MapView, Size } from '../lib/map-view';
import { drawMovePath, drawReach } from '../lib/reach-draw';
import { LAND, REFUSE, SINK, createSpring, easeSettle, stepSpring, type Spring, type SpringConfig } from '../lib/spring';
import { drawTokens, type DrawnToken, type Dust } from '../lib/token-draw';
import { DRAG_THRESHOLD, restingPoint, toMapPoint, tokenAt } from '../lib/token-geometry';
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
};

type LayerWiring = {
  /** Where the map reads the layer from. */
  overlayRef: RefObject<MapOverlay | null>;
  requestDraw: () => void;
  /** The element whose theme colours the tokens. */
  themedRef: RefObject<Element | null>;
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
};

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
  const images = useRef(new Map<string, HTMLImageElement>());
  const loading = useRef(new Set<string>());
  const { tokens, selectedId, viewerId, grid, map, motion, requestDraw, overlayRef, pendingMove } = options;

  useEffect(() => {
    latest.current = options;
  });

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
          return {
            ...token, at: dragging.at, lift: liftOf(dragging, now, reducedMotion),
            ghost: restingPoint(dragging.at, current.grid, token.size, current.map),
          };
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
      const lifting = drag.current?.started === true && now - drag.current.liftedAt < PICKUP_MS;
      return settling.current.size > 0 || dust.current.length > 0 || lifting;
    };

    /**
     * Under the tokens: the area the token in focus can still reach (the one
     * dragged, the one waiting for confirmation, else the selected one), then
     * the path and the cost of a move on its way.
     */
    const drawMoving = (context: CanvasRenderingContext2D, view: MapView, themed: Element, tokens: readonly DrawnToken[]) => {
      const current = latest.current;
      const focusId = (drag.current?.started ? drag.current.token.id : null) ?? current.pendingMove?.tokenId ?? current.selectedId;
      const token = tokens.find((candidate) => candidate.id === focusId);
      if (!token?.reach) return;
      const saved = { x: token.x, y: token.y };
      const { cellSize } = current.grid;
      drawReach(context, { token: { ...saved, size: token.size }, meters: token.reach.left, cellSize, map: current.map, view, themed });
      const target = token.ghost ?? (current.pendingMove?.tokenId === token.id ? token.at : null);
      if (target) drawMovePath(context, { from: saved, to: target, grid: current.grid, metersLeft: token.reach.left, view, themed });
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
        drawMoving(context, view, themed, tokens);
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
          liftedAt: 0, liftFrom: Math.max(0, hit.lift), velocity: { x: 0, y: 0 }, movedAt: 0,
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
        const at = {
          x: Math.min(current.map.width, Math.max(0, pointer.x + active.grip.x)),
          y: Math.min(current.map.height, Math.max(0, pointer.y + active.grip.y)),
        };
        const seconds = Math.max(1, now - active.movedAt) / 1000;
        active.velocity = {
          x: active.velocity.x * 0.6 + ((at.x - active.at.x) / seconds) * 0.4,
          y: active.velocity.y * 0.6 + ((at.y - active.at.y) / seconds) * 0.4,
        };
        active.movedAt = now;
        active.at = at;
        current.onDrag?.(active.token.id, at.x, at.y);
        current.requestDraw();
      },

      pointerUp() {
        const current = latest.current;
        const active = drag.current;
        drag.current = null;
        // A token removed mid-drag has nowhere to drop.
        if (!active?.started || !current.tokens.some((token) => token.id === active.token.id)) return;
        const rest = restingPoint(active.at, current.grid, active.token.size, current.map);
        const now = performance.now();
        drops.current.set(active.token.id, { ...rest, until: now + DROP_WAIT_MS });
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
