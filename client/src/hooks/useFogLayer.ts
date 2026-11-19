import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FOG_LIMITS, type FogOperation, type GridSettings } from '@quest-fast/shared';
import { drawFogDraft, type FogDraft } from '../lib/fog-draw';
import { TAP_SLOP, closesPolygon, fogRect, polygonOperation, rectOperation, toMap, type FogTool, type Point } from '../lib/fog-tool';
import type { MapView, Size } from '../lib/map-view';
import type { MapOverlay } from './useMapViewport';

/** The polygon being drawn, for the bar that finishes it. */
export type PolygonProgress = {
  points: number;
  /** Takes the last point back. */
  undo: () => void;
  /** Sends the polygon; only with enough points. */
  finish: () => void;
  cancel: () => void;
};

/**
 * The master's fog tools on the map. With a tool in hand, one finger (or
 * the mouse) draws instead of panning: a rectangle is a drag, a polygon a
 * click per point, closed on its first point, with Enter or "Concluir". Two
 * fingers still pan and zoom. The shape goes to `onShape` as an operation;
 * nothing changes on the map until the server answers.
 */
export function useFogLayer({ tool, grid, map, onShape, requestDraw, themedRef }: {
  tool: FogTool | null;
  grid: GridSettings;
  map: Size;
  onShape?: (operation: FogOperation) => void;
  requestDraw: () => void;
  themedRef: RefObject<Element | null>;
}): { overlay: MapOverlay | null; polygon: PolygonProgress | null; onKeyDown: (key: string) => boolean } {
  const latest = useRef({ tool, grid, map, onShape });
  useEffect(() => {
    latest.current = { tool, grid, map, onShape };
  }, [tool, grid, map, onShape]);

  const rect = useRef<{ from: Point; to: Point } | null>(null);
  const press = useRef<Point | null>(null);
  const points = useRef<Point[]>([]);
  // The count belongs to the tool it was drawn with: another tool shows none.
  const toolKey = tool ? `${tool.mode}:${tool.shape}` : '';
  const [placed, setPlaced] = useState({ key: '', count: 0 });
  const count = placed.key === toolKey ? placed.count : 0;

  const setPoints = useCallback((next: Point[]) => {
    points.current = next;
    const current = latest.current.tool;
    setPlaced({ key: current ? `${current.mode}:${current.shape}` : '', count: next.length });
    requestDraw();
  }, [requestDraw]);

  const finish = useCallback(() => {
    const current = latest.current;
    const operation = current.tool ? polygonOperation(current.tool.mode, points.current) : null;
    if (!operation) return;
    setPoints([]);
    current.onShape?.(operation);
  }, [setPoints]);

  // Another tool, or none: what was being drawn goes away.
  useEffect(() => {
    rect.current = null;
    press.current = null;
    points.current = [];
    requestDraw();
  }, [toolKey, requestDraw]);

  const overlay = useMemo<MapOverlay | null>(() => {
    if (!tool) return null;
    return {
      draw(context: CanvasRenderingContext2D, view: MapView) {
        const themed = themedRef.current ?? context.canvas;
        const { grid: g, map: m } = latest.current;
        let draft: FogDraft | null = null;
        if (rect.current) draft = { kind: 'rect', mode: tool.mode, rect: fogRect(rect.current.from, rect.current.to, g, m) };
        else if (points.current.length > 0) draft = { kind: 'polygon', mode: tool.mode, points: points.current, closing: false };
        if (draft) drawFogDraft(context, draft, view, themed);
        return false;
      },
      pointerDown(point, view) {
        press.current = point;
        if (tool.shape === 'rect') {
          const at = toMap(point, view);
          rect.current = { from: at, to: at };
          requestDraw();
        }
        return true;
      },
      pointerMove(point, view) {
        if (rect.current) {
          rect.current = { ...rect.current, to: toMap(point, view) };
          requestDraw();
        }
      },
      pointerUp(point, view) {
        const start = press.current;
        press.current = null;
        if (tool.shape === 'rect') {
          const drawn = rect.current;
          rect.current = null;
          requestDraw();
          if (!drawn) return;
          const operation = rectOperation(tool.mode, fogRect(drawn.from, toMap(point, view), latest.current.grid, latest.current.map));
          if (operation) latest.current.onShape?.(operation);
          return;
        }
        // A press that travelled is not a click: no point.
        if (!start || Math.hypot(point.x - start.x, point.y - start.y) > TAP_SLOP) return;
        if (closesPolygon(points.current, point, view)) {
          finish();
          return;
        }
        if (points.current.length >= FOG_LIMITS.maxPoints) return;
        const at = toMap(point, view);
        const { width, height } = latest.current.map;
        setPoints([...points.current, { x: Math.min(Math.max(at.x, 0), width), y: Math.min(Math.max(at.y, 0), height) }]);
      },
      cancel() {
        press.current = null;
        rect.current = null;
        requestDraw();
      },
    };
  }, [tool, themedRef, requestDraw, finish, setPoints]);

  const undo = useCallback(() => setPoints(points.current.slice(0, -1)), [setPoints]);
  const cancel = useCallback(() => setPoints([]), [setPoints]);

  /** Keys on the map while drawing: Esc drops the shape, Enter closes the polygon, Backspace takes a point back. */
  const onKeyDown = useCallback((key: string) => {
    if (!latest.current.tool) return false;
    if (key === 'Escape' && (points.current.length > 0 || rect.current)) {
      rect.current = null;
      setPoints([]);
      return true;
    }
    if (key === 'Enter' && points.current.length > 0) {
      finish();
      return true;
    }
    if (key === 'Backspace' && points.current.length > 0) {
      undo();
      return true;
    }
    return false;
  }, [finish, setPoints, undo]);

  const polygon = tool?.shape === 'polygon' && count > 0 ? { points: count, undo, finish, cancel } : null;
  return { overlay, polygon, onKeyDown };
}
