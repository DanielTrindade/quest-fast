import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { GridSettings } from '@quest-fast/shared';
import { drawMap } from '../lib/map-draw';
import { clampView, fitView, visibleRect, zoomViewAt, type MapView, type Size } from '../lib/map-view';

export const ZOOM_STEP = 1.25;
const PAN_STEP = 64;
const FRAME_MS = 220;

type Point = { x: number; y: number };

/**
 * What draws over the map (the tokens) and may claim a press before it pans
 * the map. Points are relative to the canvas, in CSS pixels.
 */
export type MapOverlay = {
  /** Draws over the map; true asks for another frame (something is moving). */
  draw(context: CanvasRenderingContext2D, view: MapView, now: number): boolean;
  /** True when the overlay takes this press (a token was hit): the map does not pan. */
  pointerDown(point: Point, view: MapView): boolean;
  pointerMove(point: Point, view: MapView): void;
  pointerUp(point: Point, view: MapView): void;
  /** The press stops being the overlay's (a second finger arrived): drop nothing. */
  cancel(): void;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ease-out with the same feel as `--ease-settle`. */
const settle = (t: number) => 1 - (1 - t) ** 4;

function localPoint(event: PointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * Loads the map image and keeps the view: pan, zoom and framing, by
 * pointer, wheel, pinch and keyboard. The view lives in refs and is drawn on
 * the next animation frame, so dragging never re-renders React; only the
 * zoom shown in the DOM is state.
 */
export function useMapViewport({ imageUrl, mapWidth, mapHeight, grid, overlayRef }: {
  imageUrl: string;
  mapWidth: number;
  mapHeight: number;
  grid: GridSettings;
  /** Read on every frame and press, so the layer never restarts the map. */
  overlayRef?: RefObject<MapOverlay | null>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const viewportRef = useRef<Size>({ width: 0, height: 0 });
  const mapRef = useRef<Size>({ width: mapWidth, height: mapHeight });
  const gridRef = useRef(grid);
  const drawRequest = useRef(0);
  const animation = useRef(0);
  const pointers = useRef(new Map<number, Point>());
  /** The pointer an overlay claimed; it never pans the map. */
  const overlayPointer = useRef<number | null>(null);
  /** Where the overlay's pointer last was, to hand it to the map for a pinch. */
  const overlayPoint = useRef<Point | null>(null);
  // The frame callback asks for the next frame through a ref: a callback
  // cannot name itself while it is being declared.
  const requestDrawRef = useRef<() => void>(() => {});
  const [loaded, setLoaded] = useState<{ url: string; ok: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const status = loaded?.url !== imageUrl ? 'loading' : loaded.ok ? 'ready' : 'error';

  const requestDraw = useCallback(() => {
    if (drawRequest.current) return;
    drawRequest.current = requestAnimationFrame(() => {
      drawRequest.current = 0;
      const context = canvasRef.current?.getContext('2d');
      if (!context) return;
      drawMap(context, {
        image: imageRef.current,
        view: viewRef.current,
        map: mapRef.current,
        viewport: viewportRef.current,
        grid: gridRef.current,
        themed: frameRef.current ?? context.canvas,
      });
      const view = viewRef.current;
      if (view && imageRef.current && overlayRef?.current?.draw(context, view, performance.now())) requestDrawRef.current();
    });
  }, [overlayRef]);
  useEffect(() => {
    requestDrawRef.current = requestDraw;
  }, [requestDraw]);



  /** Every change of the view goes through here: clamped, drawn and reported. */
  const setView = useCallback((next: MapView) => {
    const clamped = clampView(next, mapRef.current, viewportRef.current);
    viewRef.current = clamped;
    setZoom(Math.round(clamped.scale * 100));
    requestDraw();
  }, [requestDraw]);

  const stopAnimation = () => {
    cancelAnimationFrame(animation.current);
    animation.current = 0;
  };

  /** Frames the whole map; with motion allowed it glides there. */
  const frameMap = useCallback((animate: boolean) => {
    const viewport = viewportRef.current;
    if (viewport.width === 0 || viewport.height === 0) return;
    const target = fitView(mapRef.current, viewport);
    const from = viewRef.current;
    cancelAnimationFrame(animation.current);
    if (!animate || !from || prefersReducedMotion()) {
      setView(target);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = settle(Math.min(1, (now - start) / FRAME_MS));
      setView({
        x: from.x + (target.x - from.x) * t,
        y: from.y + (target.y - from.y) * t,
        scale: from.scale + (target.scale - from.scale) * t,
      });
      animation.current = t < 1 ? requestAnimationFrame(step) : 0;
    };
    animation.current = requestAnimationFrame(step);
  }, [setView]);

  const zoomBy = useCallback((factor: number, at?: Point) => {
    const view = viewRef.current;
    if (!view) return;
    stopAnimation();
    const viewport = viewportRef.current;
    setView(zoomViewAt(view, factor, at?.x ?? viewport.width / 2, at?.y ?? viewport.height / 2, mapRef.current, viewport));
  }, [setView]);

  // A new map size reframes; a new grid only redraws.
  useEffect(() => {
    const sizeChanged = mapRef.current.width !== mapWidth || mapRef.current.height !== mapHeight;
    mapRef.current = { width: mapWidth, height: mapHeight };
    gridRef.current = grid;
    if (sizeChanged && viewRef.current) frameMap(false);
    else requestDraw();
  }, [mapWidth, mapHeight, grid, frameMap, requestDraw]);

  useEffect(() => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      imageRef.current = image;
      setLoaded({ url: imageUrl, ok: true });
      frameMap(false);
    };
    image.onerror = () => {
      imageRef.current = null;
      viewRef.current = null;
      setLoaded({ url: imageUrl, ok: false });
      requestDraw();
    };
    image.src = imageUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl, attempt, frameMap, requestDraw]);

  // The canvas follows its box, with a backing store at the device's resolution.
  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      // A map loaded before the box had a size was framed into nothing.
      const wasEmpty = viewportRef.current.width === 0 || viewportRef.current.height === 0;
      viewportRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (width === 0 || height === 0) return;
      if (imageRef.current && (wasEmpty || !viewRef.current)) frameMap(false);
      else if (viewRef.current) setView(viewRef.current);
      else requestDraw();
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameMap, requestDraw, setView]);

  // The wheel must not scroll the page, which a passive React listener cannot stop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const rect = canvas.getBoundingClientRect();
      zoomBy(Math.exp(-event.deltaY * lines * 0.0015), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Released, not just cancelled: under StrictMode the effects run again,
  // and a request id left behind would block every later draw.
  useEffect(() => () => {
    cancelAnimationFrame(drawRequest.current);
    cancelAnimationFrame(animation.current);
    drawRequest.current = 0;
    animation.current = 0;
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'ready' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stopAnimation();
    const view = viewRef.current;
    const point = localPoint(event);
    // A second finger makes it the map's pinch, even if the first was on a token.
    if (overlayPointer.current !== null) {
      overlayRef?.current?.cancel();
      if (overlayPoint.current) pointers.current.set(overlayPointer.current, overlayPoint.current);
      overlayPointer.current = null;
      overlayPoint.current = null;
    } else if (view && pointers.current.size === 0 && overlayRef?.current?.pointerDown(point, view)) {
      // One finger on a token the viewer may move drags the token.
      overlayPointer.current = event.pointerId;
      overlayPoint.current = point;
      return;
    }
    pointers.current.set(event.pointerId, point);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId === overlayPointer.current) {
      overlayPoint.current = localPoint(event);
      if (viewRef.current) overlayRef?.current?.pointerMove(overlayPoint.current, viewRef.current);
      return;
    }
    const previous = pointers.current.get(event.pointerId);
    const view = viewRef.current;
    if (!previous || !view) return;
    const point = localPoint(event);
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    pointers.current.set(event.pointerId, point);

    if (!other) {
      setView({ ...view, x: view.x + point.x - previous.x, y: view.y + point.y - previous.y });
      return;
    }
    // Two fingers: zoom by how far apart they moved, around their midpoint,
    // and pan by how far the midpoint travelled.
    const before = Math.hypot(previous.x - other.x, previous.y - other.y);
    const after = Math.hypot(point.x - other.x, point.y - other.y);
    if (before === 0) return;
    const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
    const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
    setView(zoomViewAt(view, after / before, midBefore.x, midBefore.y, mapRef.current, viewportRef.current,
      { x: midAfter.x - midBefore.x, y: midAfter.y - midBefore.y }));
  };

  const onPointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId === overlayPointer.current) {
      overlayPointer.current = null;
      overlayPoint.current = null;
      if (viewRef.current) overlayRef?.current?.pointerUp(localPoint(event), viewRef.current);
      return;
    }
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const view = viewRef.current;
    if (event.target !== event.currentTarget || !view) return;
    const step = event.shiftKey ? PAN_STEP * 4 : PAN_STEP;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 }, ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step },
    };
    const move = moves[event.key];
    if (move) {
      stopAnimation();
      setView({ ...view, x: view.x + move.x, y: view.y + move.y });
    } else if (event.key === '+' || event.key === '=') zoomBy(ZOOM_STEP);
    else if (event.key === '-' || event.key === '_') zoomBy(1 / ZOOM_STEP);
    else if (event.key === '0' || event.key === 'Home') frameMap(true);
    else return;
    event.preventDefault();
  };

  /** The middle of the part of the map in view, in map pixels; the map's middle before it is drawn. */
  const viewCentre = useCallback(() => {
    const map = mapRef.current;
    const view = viewRef.current;
    if (!view) return { x: map.width / 2, y: map.height / 2 };
    const rect = visibleRect(view, map, viewportRef.current);
    return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
  }, []);

  return {
    frameRef,
    canvasRef,
    viewCentre,
    status,
    zoom,
    dragging,
    retry: () => setAttempt((count) => count + 1),
    zoomBy,
    frameMap,
    requestDraw,
    frameHandlers: { onKeyDown },
    canvasHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
    },
  };
}
