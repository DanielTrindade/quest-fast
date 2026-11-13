import { useEffect, useRef, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SceneResponse, SceneView } from '@quest-fast/shared';
import type { MapCanvasHandle } from '../../components/MapCanvas';
import { useCampaignChannel } from '../../hooks/useCampaignSocket';
import { useNotify } from '../../hooks/use-notify';
import { ApiError, api } from '../../lib/api';
import { createMoveThrottle } from '../../lib/move-throttle';
import { mergeScene } from '../../lib/scene-cache';
import { createTokenDrag, type TokenDragController } from '../../lib/token-drag';
import { stepToken } from '../../lib/token-geometry';
import { errorMessage } from './campaign-screen';

type Point = { x: number; y: number };

/**
 * The tokens' movement on a scene: the drag (`createTokenDrag`: lock on the
 * first move, its position over the socket at 30 Hz while held, saved on the
 * drop), the arrows (one cell, saved at once) and the master's hide, reveal
 * and remove. A refused lock puts the token back and says who is moving it.
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
  const latestScene = useRef(scene);
  const sceneId = scene.id;

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

  // Built on the first drag, never during render; the requests read the
  // scene and the callbacks through refs.
  const latest = useRef({ merge, refused });
  const controller = useRef<TokenDragController | null>(null);
  const drag = () => {
    controller.current ??= createTokenDrag({
      grab: (tokenId) => api.grabToken(campaignId, latestScene.current.id, tokenId).then((answer) => latest.current.merge(answer)),
      save: (tokenId, point) => api.updateToken(campaignId, latestScene.current.id, tokenId, point).then((answer) => latest.current.merge(answer)),
      throttle: createMoveThrottle((tokenId, point) => {
        send({ type: 'token.move', tokenId, ...point });
      }),
      refused: (tokenId, error) => latest.current.refused(tokenId, error),
    });
    return controller.current;
  };

  useEffect(() => {
    latest.current = { merge, refused };
    latestScene.current = scene;
    // Hidden from this player or removed mid-drag: nothing left to move.
    const active = controller.current?.active();
    if (active && !scene.tokens.some((token) => token.id === active)) controller.current?.lost(active);
  });

  // Leaving the map mid-drag puts the token back, which releases the lock.
  useEffect(() => () => {
    const active = controller.current?.active();
    if (active) controller.current?.cancel(active);
  }, []);

  const onGrab = (tokenId: string) => {
    const token = latestScene.current.tokens.find((candidate) => candidate.id === tokenId);
    if (token) drag().grab(tokenId, { x: token.x, y: token.y });
  };
  const onDrag = (tokenId: string, x: number, y: number) => drag().drag(tokenId, { x, y });
  const onDrop = (tokenId: string, x: number, y: number) => drag().drop(tokenId, { x, y });
  const onCancelDrag = (tokenId: string) => drag().cancel(tokenId);

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
    // A drag of this token still settling would save over the step.
    if (!token || drag().settling(tokenId)) return;
    const next = stepToken(token, direction, current.grid, token.size, { width: current.mapWidth, height: current.mapHeight });
    if (next.x === token.x && next.y === token.y) return;
    run(tokenId, () => api.updateToken(campaignId, sceneId, tokenId, next), 'Não foi possível mover o token');
  };

  const onToggleHidden = (tokenId: string, hidden: boolean) =>
    run(tokenId, () => api.updateToken(campaignId, sceneId, tokenId, { hidden }), hidden ? 'Não foi possível esconder o token' : 'Não foi possível revelar o token');

  const onRemove = (tokenId: string) =>
    run(tokenId, () => api.deleteToken(campaignId, sceneId, tokenId), 'Não foi possível remover o token');

  return { onGrab, onDrag, onDrop, onCancelDrag, onStep, onToggleHidden, onRemove, busyIds, settling: (tokenId: string) => controller.current?.settling(tokenId) ?? false };
}
