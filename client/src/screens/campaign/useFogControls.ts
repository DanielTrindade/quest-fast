import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FogOperation, SceneView } from '@quest-fast/shared';
import { api } from '../../lib/api';
import type { FogLook, FogTool } from '../../lib/fog-tool';
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
  const saved = ({ scene: next }: { scene: SceneView }) => mergeScene(queryClient, campaignId, next);
  const change = useMutation({
    mutationFn: (operation: FogOperation) => api.changeFog(campaignId, scene.id, operation),
    onSuccess: saved,
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.updateScene(campaignId, scene.id, { fogEnabled: enabled }),
    onSuccess: saved,
  });
  // The last request decides what the toolbar says: a refusal stays until the next try.
  const failed = change.isError ? change.error : toggle.isError ? toggle.error : null;

  return {
    tool,
    setTool,
    playerView,
    setPlayerView,
    /** A player always sees the fog opaque; the master, unless looking as one. */
    look: (isMaster && !playerView ? 'master' : 'player') as FogLook,
    apply: (operation: FogOperation) => change.mutate(operation),
    setEnabled: (enabled: boolean) => toggle.mutate(enabled),
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
