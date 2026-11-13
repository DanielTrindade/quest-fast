import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { GridSettings, TokenView } from '@quest-fast/shared';
import type { MapOverlay } from './useMapViewport';
import type { MapView, Size } from '../lib/map-view';
import { drawTokens, type DrawnToken } from '../lib/token-draw';
import { DRAG_THRESHOLD, restingPoint, toMapPoint, tokenAt } from '../lib/token-geometry';
import type { TokenMotionSource } from '../lib/token-motion';

type Point = { x: number; y: number };

/** How long a dropped token waits for the server's answer before going back. */
const DROP_WAIT_MS = 4000;

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
  /** Where the tokens others drag are, fed by the socket. */
  motion?: TokenMotionSource;
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
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The tokens as a layer of the map canvas: draws them, picks the one under
 * the pointer, and turns a press on a movable token into a drag (the map pans
 * otherwise). A token someone else drags is drawn where the motion source puts
 * it; the one dragged here follows the pointer and, dropped, stays at its
 * resting point until the server's answer brings it there (or gives up).
 */
export function useTokenLayer(options: TokenLayerOptions & LayerWiring): void {
  const latest = useRef(options);
  const drag = useRef<Drag | null>(null);
  const drops = useRef(new Map<string, Point & { until: number }>());
  const images = useRef(new Map<string, HTMLImageElement>());
  const loading = useRef(new Set<string>());
  const { tokens, selectedId, viewerId, grid, map, motion, requestDraw, overlayRef } = options;

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
  }, [tokens, selectedId, viewerId, grid, map.width, map.height, requestDraw]);

  // One layer for the component's life; it reads the props through `latest`.
  const overlay = useMemo<MapOverlay>(() => {
    const drawn = (now: number): DrawnToken[] => {
      const current = latest.current;
      const reducedMotion = prefersReducedMotion();
      return current.tokens.map((token) => {
        const dragging = drag.current?.started && drag.current.token.id === token.id ? drag.current : null;
        if (dragging) {
          return { ...token, at: dragging.at, lifted: true, ghost: restingPoint(dragging.at, current.grid, token.size, current.map) };
        }
        const dropped = drops.current.get(token.id);
        if (dropped && (now > dropped.until || (token.x === dropped.x && token.y === dropped.y))) drops.current.delete(token.id);
        else if (dropped) return { ...token, at: dropped, lifted: false, ghost: null };
        const moving = token.movingBy && token.movingBy.userId !== current.viewerId
          ? current.motion?.positionOf(token.id, now, { reducedMotion })
          : null;
        return { ...token, at: moving ?? token, lifted: false, ghost: null };
      });
    };

    return {
      draw(context, view: MapView, now) {
        const current = latest.current;
        const themed = current.themedRef.current ?? context.canvas;
        drawTokens(context, {
          tokens: drawn(now),
          view,
          cellSize: current.grid.cellSize,
          selectedId: current.selectedId,
          viewerId: current.viewerId,
          images: images.current,
          themed,
        });
        return (current.motion?.animating(now) ?? false) || drops.current.size > 0;
      },

      pointerDown(point, view) {
        const current = latest.current;
        const hit = tokenAt(drawn(performance.now()), point, view, current.grid.cellSize);
        if (!hit) return false;
        current.onSelect?.(hit.id);
        if (!current.canMove?.(hit)) return false;
        const pressed = toMapPoint(view, point);
        drag.current = { token: hit, start: point, grip: { x: hit.at.x - pressed.x, y: hit.at.y - pressed.y }, started: false, at: hit.at };
        return true;
      },

      pointerMove(point, view) {
        const current = latest.current;
        const active = drag.current;
        if (!active) return;
        if (!active.started) {
          if (Math.hypot(point.x - active.start.x, point.y - active.start.y) < DRAG_THRESHOLD) return;
          active.started = true;
          current.onGrab?.(active.token.id);
        }
        const pointer = toMapPoint(view, point);
        active.at = {
          x: Math.min(current.map.width, Math.max(0, pointer.x + active.grip.x)),
          y: Math.min(current.map.height, Math.max(0, pointer.y + active.grip.y)),
        };
        current.onDrag?.(active.token.id, active.at.x, active.at.y);
        current.requestDraw();
      },

      pointerUp() {
        const current = latest.current;
        const active = drag.current;
        drag.current = null;
        if (!active?.started) return;
        const rest = restingPoint(active.at, current.grid, active.token.size, current.map);
        drops.current.set(active.token.id, { ...rest, until: performance.now() + DROP_WAIT_MS });
        current.onDrop?.(active.token.id, rest.x, rest.y);
        current.requestDraw();
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
}
