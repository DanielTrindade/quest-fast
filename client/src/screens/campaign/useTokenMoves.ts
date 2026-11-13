import { useEffect, useRef, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SceneResponse, SceneView } from '@quest-fast/shared';
import type { MapCanvasHandle } from '../../components/MapCanvas';
import { useCampaignChannel } from '../../hooks/useCampaignSocket';
import { useNotify } from '../../hooks/use-notify';
import { ApiError, api } from '../../lib/api';
import { createMoveThrottle } from '../../lib/move-throttle';
import { mergeScene } from '../../lib/scene-cache';
import { createTokenDrag, type HeldMove, type TokenDragController } from '../../lib/token-drag';
import { stepToken } from '../../lib/token-geometry';
import { errorMessage } from './campaign-screen';

type Point = { x: number; y: number };

/**
 * The tokens' movement on a scene: the drag (`createTokenDrag`: lock on the
 * first move, its position over the socket at 30 Hz while held, saved on the
 * drop), the arrows (one cell, saved at once) and the master's hide, reveal
 * and remove. A refused lock puts the token back and says who is moving it.
 *
 * In a fight, a move of the combatant whose turn it is (`confirms`) waits:
 * the drop or the arrows leave it pending — locked, and seen by the table —
 * until it is confirmed (the server spends it) or cancelled (the token goes
 * back). If the turn passes meanwhile, the server lets go of the lock and the
 * pending move is dropped here too.
 */
export function useTokenMoves({ campaignId, scene, mapRef, confirms }: {
  campaignId: string;
  scene: SceneView;
  mapRef: RefObject<MapCanvasHandle | null>;
  /** Whether a move of this token waits for confirmation. */
  confirms: (tokenId: string) => boolean;
}) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { send } = useCampaignChannel();
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [held, setHeld] = useState<HeldMove | null>(null);
  const [confirming, setConfirming] = useState(false);
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
      save: (tokenId, point, options) => api.updateToken(campaignId, latestScene.current.id, tokenId, { ...point, ...options })
        .then((answer) => latest.current.merge(answer)),
      throttle: createMoveThrottle((tokenId, point) => {
        send({ type: 'token.move', tokenId, ...point });
      }),
      refused: (tokenId, error) => latest.current.refused(tokenId, error),
      onHeld: setHeld,
      // However a gesture ends — saved, put back, refused before the lock — the buttons are free again.
      onSettled: () => setConfirming(false),
    });
    return controller.current;
  };

  useEffect(() => {
    latest.current = { merge, refused };
    latestScene.current = scene;
    const drags = controller.current;
    const active = drags?.active();
    if (!drags || !active) return;
    const token = scene.tokens.find((candidate) => candidate.id === active);
    // Hidden from this player or removed mid-drag: nothing left to move.
    if (!token) {
      drags.lost(active);
      return;
    }
    // The turn passed, or the server let go of the lock: the pending move is
    // over, and the token is where the server says.
    const lockLost = drags.granted(active) && token.movingBy === null;
    if (held?.tokenId === active && (!confirms(active) || lockLost)) {
      mapRef.current?.cancelDrag(active);
      drags.forget(active);
    }
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
  const onDrop = (tokenId: string, x: number, y: number) => drag().drop(tokenId, { x, y }, { hold: confirms(tokenId) });
  const onCancelDrag = (tokenId: string) => drag().cancel(tokenId);

  /** A request about one token, with its row busy meanwhile. */
  const run = (tokenId: string, request: () => Promise<SceneResponse>, failure: string) => {
    setBusyIds((ids) => new Set(ids).add(tokenId));
    return request()
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
    // A drag of this token still settling would be saved over.
    if (!token || drag().settling(tokenId)) return;
    const from = held?.tokenId === tokenId ? held : token;
    const next = stepToken(from, direction, current.grid, token.size, { width: current.mapWidth, height: current.mapHeight });
    if (next.x === from.x && next.y === from.y) return;
    if (confirms(tokenId)) {
      // The same protocol as a drag: locked, seen by the table, held until confirmed.
      // A held move is picked up again (same lock); a new one asks for the lock.
      drag().grab(tokenId, { x: token.x, y: token.y });
      drag().drop(tokenId, next, { hold: true });
      return;
    }
    void run(tokenId, () => api.updateToken(campaignId, sceneId, tokenId, next), 'Não foi possível mover o token');
  };

  const confirm = ({ free = false } = {}) => {
    if (!held) return;
    setConfirming(true);
    drag().confirm(held.tokenId, { free });
  };

  const cancel = () => {
    if (!held) return;
    mapRef.current?.cancelDrag(held.tokenId);
    drag().cancel(held.tokenId);
  };

  const onToggleHidden = (tokenId: string, hidden: boolean) =>
    void run(tokenId, () => api.updateToken(campaignId, sceneId, tokenId, { hidden }), hidden ? 'Não foi possível esconder o token' : 'Não foi possível revelar o token');

  const onRemove = (tokenId: string) =>
    void run(tokenId, () => api.deleteToken(campaignId, sceneId, tokenId), 'Não foi possível remover o token');

  return {
    onGrab, onDrag, onDrop, onCancelDrag, onStep, onToggleHidden, onRemove, busyIds,
    settling: (tokenId: string) => controller.current?.settling(tokenId) ?? false,
    pending: held, confirm, cancel, confirming,
  };
}
