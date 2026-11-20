import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FogOperation, SceneView } from '@quest-fast/shared';
import { api } from '../../lib/api';
import { fogFailure, type FogAction, type FogLook, type FogTool } from '../../lib/fog-tool';
import { mergeScene } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';

/**
 * The master's fog on the Mesa: the tool in hand and "ver como jogador" stay
 * on this screen; turning the fog on and every shape go to the server, and
 * the map changes only with its answer (the official fog is the server's).
 * The same answer reaches the table by the socket.
 */
export function useFogControls(campaignId: string, scene: SceneView, isMaster: boolean) {
  const queryClient = useQueryClient();
  const [tool, setTool] = useState<FogTool | null>(null);
  const [playerView, setPlayerView] = useState(false);
  const [last, setLast] = useState<FogAction | null>(null);
  const saved = ({ scene: next }: { scene: SceneView }) => mergeScene(queryClient, campaignId, next);
  const change = useMutation({
    mutationFn: (operation: FogOperation) => api.changeFog(campaignId, scene.id, operation),
    onSuccess: saved,
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.updateScene(campaignId, scene.id, { fogEnabled: enabled }),
    onSuccess: saved,
  });
  // The toolbar speaks of the last action only: an older refusal goes once another action is asked.
  const failed = fogFailure(last, { shape: change.error, toggle: toggle.error });

  return {
    tool,
    setTool,
    playerView,
    setPlayerView,
    /** A player always sees the fog opaque; the master, unless looking as one. */
    look: (isMaster && !playerView ? 'master' : 'player') as FogLook,
    apply: (operation: FogOperation) => {
      setLast('shape');
      change.mutate(operation);
    },
    setEnabled: (enabled: boolean) => {
      setLast('toggle');
      toggle.mutate(enabled);
    },
    busy: change.isPending || toggle.isPending,
    error: failed ? errorMessage(failed) : undefined,
    /** The panel closed: the map pans again and shows the master's own view. */
    putAway: () => {
      setTool(null);
      setPlayerView(false);
    },
  };
}

export type FogControls = ReturnType<typeof useFogControls>;
