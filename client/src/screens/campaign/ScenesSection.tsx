import { useState } from 'react';
import { MapTrifold } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { SceneList } from '../../components/SceneList';
import { Skeleton } from '../../components/Skeleton';
import { sectionHeading } from '../../components/layout-styles';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { mergeScene, removeScene, sceneListQuery } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';
import { SceneFormDialog } from './SceneFormDialog';
import { ScenePreviewDialog } from './ScenePreviewDialog';

type Editing = { sceneId: string | null } | null;

/**
 * The master's scenes in prep: creating, editing and deleting them, and
 * opening one for the table. The server answers and the socket confirms;
 * both go through the same merge, so neither undoes the other.
 */
export function ScenesSection({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const scenes = useQuery(sceneListQuery(campaignId));
  const [editing, setEditing] = useState<Editing>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const failed = (title: string) => (error: unknown) => notify({ title, description: errorMessage(error), variant: 'error' });

  const openForTable = useMutation({
    mutationFn: (sceneId: string | null) => api.setActiveScene(campaignId, { sceneId }),
    onSuccess: (opened) => { if (opened) mergeScene(queryClient, campaignId, opened); },
    onError: failed('Não foi possível mudar o mapa da mesa'),
    // The closed scene's new version arrives by the socket; a list asked again
    // covers a socket that is down.
    onSettled: () => queryClient.invalidateQueries({ queryKey: sceneListQuery(campaignId).queryKey }),
  });

  const remove = useMutation({
    mutationFn: (sceneId: string) => api.deleteScene(campaignId, sceneId),
    onSuccess: (_, sceneId) => removeScene(queryClient, campaignId, sceneId),
    onError: failed('Não foi possível excluir a cena'),
  });

  // Closing the table names no scene: the row pending is the one open.
  const openRow = scenes.data?.scenes.find((scene) => scene.active)?.id;
  const pendingSceneId = openForTable.isPending ? (openForTable.variables ?? openRow) : remove.isPending ? remove.variables : undefined;
  const viewingScene = viewing ? scenes.data?.scenes.find((scene) => scene.id === viewing) : undefined;
  const editingScene = editing?.sceneId ? scenes.data?.scenes.find((scene) => scene.id === editing.sceneId) ?? null : null;

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="scenes-title">
      <div className={sectionHeading}>
        <h2 id="scenes-title"><MapTrifold size={20} aria-hidden="true" /> Cenas</h2>
      </div>

      {scenes.isPending && <Skeleton shape="panel" label="Carregando as cenas…" />}
      {/* A failed refresh keeps the list it already has, with the way to try again. */}
      {scenes.isError && (
        <div className="grid justify-items-start gap-3">
          <p role="alert" className="text-body text-danger-text">{errorMessage(scenes.error)}</p>
          <Button variant="secondary" loading={scenes.isFetching} onClick={() => { void scenes.refetch(); }}>Tentar novamente</Button>
        </div>
      )}
      {scenes.data && (
        <SceneList scenes={scenes.data.scenes} pendingSceneId={pendingSceneId}
          onCreate={() => setEditing({ sceneId: null })}
          onEdit={(sceneId) => setEditing({ sceneId })}
          onView={setViewing}
          onOpenForTable={(sceneId) => openForTable.mutate(sceneId)}
          onCloseTable={() => openForTable.mutate(null)}
          onDelete={(sceneId) => remove.mutate(sceneId)} />
      )}

      {viewingScene && (
        <ScenePreviewDialog campaignId={campaignId} sceneId={viewingScene.id} name={viewingScene.name} onClose={() => setViewing(null)} />
      )}

      {editing && (editing.sceneId === null || editingScene) && (
        <SceneFormDialog campaignId={campaignId} scene={editingScene}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            notify({ title: created ? `Cena ${saved.name} criada` : `Cena ${saved.name} salva`, variant: 'success' });
          }} />
      )}
    </section>
  );
}
