import { useEffect, useRef, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SceneResponse, SceneView, TokenPatch } from '@quest-fast/shared';
import type { MapCanvasHandle } from '../../components/MapCanvas';
import { useCampaignChannel } from '../../hooks/useCampaignSocket';
import { useNotify } from '../../hooks/use-notify';
import { ApiError, api } from '../../lib/api';
import { createMoveThrottle } from '../../lib/move-throttle';
import { mergeScene } from '../../lib/scene-cache';
import { stepToken } from '../../lib/token-geometry';
import { errorMessage } from './campaign-screen';

type Point = { x: number; y: number };

/** One drag, from the press to the server's answer about the drop. */
type Drag = {
  tokenId: string;
  /** Where the token was saved: a cancelled drag goes back there. */
  origin: Point;
  granted: boolean;
  latest: Point | null;
  /** Dropped before the lock arrived: saved once it does. */
  dropped: Point | null;
  /** Cancelled before the lock arrived: put back once it does, which also releases it. */
  cancelled: boolean;
};

/**
 * The tokens' movement on a scene: the drag (lock on the first move, its
 * position over the socket at 30 Hz while held, saved on the drop), the
 * arrows (one cell, saved at once) and the master's hide, reveal and remove.
 * A refused lock puts the token back and says who is moving it.
 */
export function useTokenMoves({ campaignId, scene, mapRef }: {
  campaignId: string;
  scene: SceneView;
  mapRef: RefObject<MapCanvasHandle | null>;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { send } = useCampaignChannel();
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const drag = useRef<Drag | null>(null);
  const latestScene = useRef(scene);
  const sceneId = scene.id;
  const [throttle] = useState(() => createMoveThrottle((tokenId, point) => {
    send({ type: 'token.move', tokenId, ...point });
  }));

  useEffect(() => {
    latestScene.current = scene;
    // Hidden from this player or removed mid-drag: nothing left to move.
    const current = drag.current;
    if (current && !scene.tokens.some((token) => token.id === current.tokenId)) {
      drag.current = null;
      throttle.stop();
    }
  });

  useEffect(() => () => throttle.stop(), [throttle]);

  const merge = ({ scene: saved }: SceneResponse) => mergeScene(queryClient, campaignId, saved);

  const refused = (tokenId: string, error: unknown) => {
    mapRef.current?.cancelDrag(tokenId);
    const locked = error instanceof ApiError && error.status === 409;
    notify({
      title: locked ? 'Este token está em uso' : 'Não foi possível mover o token',
      description: errorMessage(error),
      variant: 'error',
    });
  };

  const save = (tokenId: string, patch: TokenPatch, { quiet = false } = {}) =>
    api.updateToken(campaignId, sceneId, tokenId, patch).then(merge, (error: unknown) => {
      if (quiet) return;
      refused(tokenId, error);
    });

  const settle = (current: Drag) => {
    if (current.cancelled) void save(current.tokenId, current.origin, { quiet: true });
    else if (current.dropped) void save(current.tokenId, current.dropped);
  };

  const onGrab = (tokenId: string) => {
    const token = latestScene.current.tokens.find((candidate) => candidate.id === tokenId);
    if (!token) return;
    const current: Drag = { tokenId, origin: { x: token.x, y: token.y }, granted: false, latest: null, dropped: null, cancelled: false };
    drag.current = current;
    throttle.stop();
    api.grabToken(campaignId, sceneId, tokenId).then(
      (answer) => {
        merge(answer);
        current.granted = true;
        if (current.cancelled || current.dropped) settle(current);
        else if (drag.current === current && current.latest) throttle.move(tokenId, current.latest);
      },
      (error: unknown) => {
        if (drag.current === current) {
          drag.current = null;
          throttle.stop();
        }
        // Already put back by the user (a pinch): nothing to say.
        if (!current.cancelled) refused(tokenId, error);
      },
    );
  };

  const onDrag = (tokenId: string, x: number, y: number) => {
    const current = drag.current;
    if (current?.tokenId !== tokenId) return;
    current.latest = { x, y };
    if (current.granted) throttle.move(tokenId, current.latest);
  };

  const onDrop = (tokenId: string, x: number, y: number) => {
    const current = drag.current;
    if (current?.tokenId !== tokenId) return;
    drag.current = null;
    throttle.stop();
    current.dropped = { x, y };
    if (current.granted) settle(current);
  };

  const onCancelDrag = (tokenId: string) => {
    const current = drag.current;
    if (current?.tokenId !== tokenId) return;
    drag.current = null;
    throttle.stop();
    current.cancelled = true;
    if (current.granted) settle(current);
  };

  /** A request about one token, with its row busy meanwhile. */
  const run = (tokenId: string, request: () => Promise<SceneResponse>, failure: string) => {
    setBusyIds((ids) => new Set(ids).add(tokenId));
    request()
      .then(merge, (error: unknown) => notify({ title: failure, description: errorMessage(error), variant: 'error' }))
      .finally(() => setBusyIds((ids) => {
        const next = new Set(ids);
        next.delete(tokenId);
        return next;
      }));
  };

  const onStep = (tokenId: string, direction: Point) => {
    const current = latestScene.current;
    const token = current.tokens.find((candidate) => candidate.id === tokenId);
    if (!token) return;
    const next = stepToken(token, direction, current.grid, token.size, { width: current.mapWidth, height: current.mapHeight });
    if (next.x === token.x && next.y === token.y) return;
    run(tokenId, () => api.updateToken(campaignId, sceneId, tokenId, next), 'Não foi possível mover o token');
  };

  const onToggleHidden = (tokenId: string, hidden: boolean) =>
    run(tokenId, () => api.updateToken(campaignId, sceneId, tokenId, { hidden }), hidden ? 'Não foi possível esconder o token' : 'Não foi possível revelar o token');

  const onRemove = (tokenId: string) =>
    run(tokenId, () => api.deleteToken(campaignId, sceneId, tokenId), 'Não foi possível remover o token');

  return { onGrab, onDrag, onDrop, onCancelDrag, onStep, onToggleHidden, onRemove, busyIds };
}
