import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AreaGeometry, AreaInput, AreaPatch, SceneView } from '@quest-fast/shared';
import { useCampaignChannel } from '../../hooks/useCampaignSocket';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { DEFAULT_AREA_DRAFT, type AreaDraft, type AreaTool } from '../../lib/area-tool';
import { mergeScene } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';

/**
 * The area templates on the Mesa (#113). The draft and the tool in hand stay
 * on this screen; a reference area goes to the table over the socket while
 * it is drawn, and a persistent one goes to the server, the map showing it
 * with the answer (the same answer reaches the table by the socket).
 */
export function useAreaControls(campaignId: string, scene: SceneView, isMaster: boolean) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { send, previews } = useCampaignChannel();
  const [draft, setDraft] = useState<AreaDraft>(DEFAULT_AREA_DRAFT);
  const [drawing, setDrawing] = useState(false);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const saved = ({ scene: next }: { scene: SceneView }) => mergeScene(queryClient, campaignId, next);

  const create = useMutation({
    mutationFn: (input: AreaInput) => api.createArea(campaignId, scene.id, input),
    onSuccess: (response) => {
      saved(response);
      setDrawing(false);
    },
  });
  const busy = (areaId: string, on: boolean) => setBusyIds((current) => {
    const next = new Set(current);
    if (on) next.add(areaId);
    else next.delete(areaId);
    return next;
  });
  const update = useMutation({
    mutationFn: ({ areaId, patch }: { areaId: string; patch: AreaPatch }) => api.updateArea(campaignId, scene.id, areaId, patch),
    onMutate: ({ areaId }) => busy(areaId, true),
    onSettled: (_data, _error, { areaId }) => busy(areaId, false),
    onSuccess: saved,
    onError: (error) => notify({ title: 'Não foi possível mudar a área', description: errorMessage(error), variant: 'error' }),
  });
  const remove = useMutation({
    mutationFn: (areaId: string) => api.removeArea(campaignId, scene.id, areaId),
    onMutate: (areaId) => busy(areaId, true),
    onSettled: (_data, _error, areaId) => busy(areaId, false),
    onSuccess: saved,
    onError: (error) => notify({ title: 'Não foi possível remover a área', description: errorMessage(error), variant: 'error' }),
  });

  const persistentInput = (geometry: AreaGeometry, anchorTokenId: string | null = null): AreaInput => ({
    ...geometry,
    name: draft.name.trim(),
    tint: draft.tint,
    hidden: isMaster && draft.hidden,
    anchorTokenId,
  });
  const tool: AreaTool | null = drawing ? { mode: draft.mode, shape: draft.shape, size: draft.size, width: draft.width } : null;

  return {
    draft,
    setDraft,
    drawing,
    setDrawing,
    tool,
    previews,
    busyIds,
    busy: create.isPending,
    error: create.isError ? errorMessage(create.error) : undefined,
    /** What the viewer draws, for the table; lost quietly when the socket is down. */
    preview: (area: AreaGeometry | null, done: boolean) => {
      send({ type: 'area.preview', sceneId: scene.id, area, done });
    },
    place: (geometry: AreaGeometry) => create.mutate(persistentInput(geometry)),
    /** A persistent area following this token: centred on it, so the geometry's own origin is only a placeholder. */
    anchorOn: (tokenId: string, at: { x: number; y: number }) =>
      create.mutate(persistentInput({ shape: draft.shape, size: draft.size, width: draft.width, x: at.x, y: at.y, angle: 0 }, tokenId)),
    toggleHidden: (areaId: string, hidden: boolean) => update.mutate({ areaId, patch: { hidden } }),
    remove: (areaId: string) => remove.mutate(areaId),
    /** Another tool came into hand, or the panel closed. */
    putAway: () => setDrawing(false),
  };
}

export type AreaControls = ReturnType<typeof useAreaControls>;
