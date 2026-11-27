import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { SceneFog } from '@quest-fast/shared';
import { areasForLook } from '../lib/area-tool';
import type { FogLook } from '../lib/fog-tool';
import type { AreaGeometry, AreaView, GridSettings, TokenView } from '@quest-fast/shared';
import { drawArea, type AreaLook } from '../lib/area-draw';
import type { AreaPreviewSource } from '../lib/area-preview';
import { draftGeometry, type AreaTool } from '../lib/area-tool';
import { toMap, type Point } from '../lib/fog-tool';
import type { MapView, Size } from '../lib/map-view';
import type { TokenMotionSource } from '../lib/token-motion';
import type { MapOverlay } from './useMapViewport';
import type { TokenLayerOptions } from './useTokenLayer';

/** A reference area is sent at most this often while drawn: the pace of a dragged token. */
const PREVIEW_INTERVAL_MS = 33;
/**
 * A reference area held still is sent again this often, so the table keeps
 * it: whoever watches drops one silent for `AREA_LIMITS.previewStaleMs`.
 */
const PREVIEW_HEARTBEAT_MS = 500;
/** Our own reference area stays on our map as long as it does on the table's. */
const OWN_LINGER_MS = 5000;

export type AreaLayerOptions = {
  sceneId: string;
  /** The persistent areas the viewer receives, already as the look shows them. */
  areas: readonly AreaView[];
  /** Ids of the areas drawn faded: hidden from the table. */
  fadedIds?: ReadonlySet<string>;
  /** The tokens on the map, for the areas that follow one. */
  tokens: readonly TokenView[];
  grid: GridSettings;
  map: Size;
  /** The area tool in hand: one finger draws instead of panning. */
  tool: AreaTool | null;
  /** What the viewer is drawing, for the table: `null` clears it, `done` lets it go. */
  onPreview?: (area: AreaGeometry | null, done: boolean) => void;
  /** A persistent area the viewer finished drawing, to save. */
  onPlace?: (area: AreaGeometry) => void;
  /** Where others drag tokens: an area following one moves with it. */
  motion?: TokenMotionSource;
  /** The reference areas others draw. */
  previews?: AreaPreviewSource;
  /** Where the viewer's own drag has a token right now, if it does. */
  ownDrag?: RefObject<{ tokenId: string; x: number; y: number } | null>;
  /** A move dropped but not confirmed yet: the token waits there, and an area following it too. */
  pendingMove?: { tokenId: string; x: number; y: number } | null;
};

type Wiring = { requestDraw: () => void; themedRef: RefObject<Element | null> };

/**
 * The area templates on the map (#113): the scene's persistent areas (one
 * following a token moves with it, live), the reference areas others are
 * drawing, and the one the viewer draws with the tool in hand. With a tool,
 * a press places the origin and the drag aims it (a circle follows the
 * pointer); letting go places a persistent area, or leaves a reference one
 * on the table for a moment.
 */
export function useAreaLayer(options: AreaLayerOptions & Wiring): MapOverlay {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const { requestDraw, themedRef, motion, previews, tool } = options;
  const press = useRef<Point | null>(null);
  const draft = useRef<{ area: AreaGeometry; done: boolean; at: number } | null>(null);
  const sentAt = useRef(0);
  const heartbeat = useRef(0);
  // Unmounted while held: nothing keeps sending.
  useEffect(() => () => window.clearInterval(heartbeat.current), []);

  // Others' previews and drags wake an idle canvas.
  useEffect(() => previews?.subscribe(requestDraw), [previews, requestDraw]);
  useEffect(() => motion?.subscribe(requestDraw), [motion, requestDraw]);

  // Another tool, or none: what was being drawn goes, for the table too.
  const toolKey = tool ? `${tool.mode}:${tool.shape}:${tool.size}:${tool.width}` : '';
  useEffect(() => {
    press.current = null;
    window.clearInterval(heartbeat.current);
    if (draft.current && !draft.current.done) latest.current.onPreview?.(null, false);
    draft.current = null;
    requestDraw();
  }, [toolKey, requestDraw]);

  return useMemo<MapOverlay>(() => {
    const send = (area: AreaGeometry | null, done: boolean, now: number) => {
      if (latest.current.tool?.mode !== 'reference') return;
      if (!done && area && now - sentAt.current < PREVIEW_INTERVAL_MS) return;
      sentAt.current = now;
      latest.current.onPreview?.(area, done);
    };
    const aim = (point: Point, view: MapView) => {
      const { tool: held, grid } = latest.current;
      if (!held || !press.current) return;
      const area = draftGeometry(held, toMap(press.current, view), toMap(point, view), grid);
      const now = performance.now();
      draft.current = { area, done: false, at: now };
      send(area, false, now);
      requestDraw();
    };
    const beat = () => {
      const held = draft.current;
      if (held && !held.done && latest.current.tool?.mode === 'reference') latest.current.onPreview?.(held.area, false);
    };
    const stopBeat = () => window.clearInterval(heartbeat.current);
    return {
      draw(context, view, now) {
        const current = latest.current;
        const themed = themedRef.current ?? context.canvas;
        const scene = { view, grid: current.grid, map: current.map, themed };
        const positionOf = (token: TokenView) => {
          const own = current.ownDrag?.current;
          if (own?.tokenId === token.id) return { x: own.x, y: own.y };
          const pending = current.pendingMove;
          if (pending?.tokenId === token.id) return { x: pending.x, y: pending.y };
          return current.motion?.positionOf(token.id, now) ?? token;
        };
        let moving = false;
        const byId = new Map(current.tokens.map((token) => [token.id, token]));
        for (const area of current.areas) {
          const anchor = area.anchorTokenId ? byId.get(area.anchorTokenId) : undefined;
          // Its token is not on this map (as a player would see it): neither is the area.
          if (area.anchorTokenId && !anchor) continue;
          const at = anchor ? positionOf(anchor) : area;
          const look: AreaLook = current.fadedIds?.has(area.id) ? 'hidden' : 'saved';
          drawArea(context, {
            geometry: { ...area, x: at.x, y: at.y },
            tint: area.tint,
            look,
            anchorSize: anchor?.size ?? null,
            label: anchor ? undefined : area.name,
          }, scene);
        }
        for (const preview of current.previews?.shown(current.sceneId, now) ?? []) {
          drawArea(context, { geometry: preview.area, tint: 'azure', look: 'preview', label: preview.name }, scene);
          moving = true;
        }
        const own = draft.current;
        if (own && (!own.done || now - own.at <= OWN_LINGER_MS)) {
          drawArea(context, { geometry: own.area, tint: 'amber', look: 'preview' }, scene);
          if (own.done) moving = true;
        } else if (own) {
          draft.current = null;
        }
        if (current.motion?.animating(now) && current.areas.some((area) => area.anchorTokenId)) moving = true;
        return moving;
      },
      pointerDown(point, view) {
        if (!latest.current.tool) return false;
        press.current = point;
        aim(point, view);
        stopBeat();
        heartbeat.current = window.setInterval(beat, PREVIEW_HEARTBEAT_MS);
        return true;
      },
      pointerMove(point, view) {
        aim(point, view);
      },
      pointerUp(point, view) {
        aim(point, view);
        press.current = null;
        stopBeat();
        const drawn = draft.current;
        if (!drawn) return;
        const now = performance.now();
        if (latest.current.tool?.mode === 'persistent') {
          draft.current = null;
          latest.current.onPlace?.(drawn.area);
        } else {
          draft.current = { ...drawn, done: true, at: now };
          send(drawn.area, true, now);
        }
        requestDraw();
      },
      cancel() {
        press.current = null;
        stopBeat();
        if (draft.current && !draft.current.done) send(null, false, performance.now());
        draft.current = null;
        requestDraw();
      },
    };
  }, [requestDraw, themedRef]);
}

type TokenDrag = Pick<TokenLayerOptions, 'onDrag' | 'onDrop' | 'onCancelDrag'>;

/**
 * The areas' side of the map: what the look shows of them, the layer that
 * draws them, and the token drag callbacks wrapped so an area following the
 * viewer's own dragged token moves with it.
 */
export function useMapAreas({ areas, tokens, shown, fog, look, master, viewerId, drag, ...layer }: Omit<AreaLayerOptions, 'areas' | 'fadedIds' | 'tokens' | 'ownDrag'> & Wiring & {
  areas: readonly AreaView[];
  /** Every token the viewer received, and the ones the look shows. */
  tokens: readonly TokenView[];
  shown: readonly TokenView[];
  fog: SceneFog | null;
  look: FogLook;
  master: boolean;
  viewerId: string | null;
  drag: TokenDrag;
}) {
  const ownDrag = useRef<{ tokenId: string; x: number; y: number } | null>(null);
  const areaLook = useMemo(() => areasForLook(areas, tokens, { fog, look, master, viewerId }), [areas, tokens, fog, look, master, viewerId]);
  const { onDrag, onDrop, onCancelDrag } = drag;
  const dragged = useMemo<TokenDrag>(() => ({
    onDrag: (tokenId, x, y) => {
      ownDrag.current = { tokenId, x, y };
      onDrag?.(tokenId, x, y);
    },
    onDrop: (tokenId, x, y) => {
      ownDrag.current = null;
      onDrop?.(tokenId, x, y);
    },
    onCancelDrag: (tokenId) => {
      ownDrag.current = null;
      onCancelDrag?.(tokenId);
    },
  }), [onDrag, onDrop, onCancelDrag]);
  const overlay = useAreaLayer({ ...layer, areas: areaLook.areas, fadedIds: areaLook.faded, tokens: shown, ownDrag });
  const { requestDraw } = layer;
  // New areas, or one moved or removed, show at once. A move waiting for confirmation takes the area following its token along.
  const { pendingMove } = layer;
  useEffect(() => requestDraw(), [areaLook, pendingMove, requestDraw]);
  return { overlay, dragged, areas: areaLook.areas };
}
