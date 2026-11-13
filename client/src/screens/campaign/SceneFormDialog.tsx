import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SceneSummary, SceneView } from '@quest-fast/shared';
import { Dialog } from '../../components/Dialog';
import { SceneForm, type SceneUpload } from '../../components/SceneForm';
import { dialogWide } from '../../components/layout-styles';
import { UploadAborted, api } from '../../lib/api';
import { mergeScene } from '../../lib/scene-cache';
import { errorMessage } from './campaign-screen';

/**
 * Creating a scene, or editing one: its name and, optionally, a new map.
 * The map goes up with its progress shown; closing the dialog mid-upload
 * cancels it. A new map is sent before a new name, so a refused image leaves
 * the scene as it was.
 */
export function SceneFormDialog({ campaignId, scene, onClose, onSaved }: {
  campaignId: string;
  /** The scene being edited; null to create one. */
  scene: SceneSummary | null;
  onClose: () => void;
  onSaved: (scene: SceneView, created: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState<SceneUpload>();
  const aborter = useRef<AbortController | null>(null);

  // Leaving the screen mid-upload drops the request with it.
  useEffect(() => () => aborter.current?.abort(), []);

  const save = useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File | null }) => {
      const controller = new AbortController();
      aborter.current = controller;
      const options = { onProgress: setUpload, signal: controller.signal };
      if (!scene) return (await api.createScene(campaignId, name, file!, options)).scene;
      let saved: SceneView | null = null;
      if (file) {
        saved = (await api.replaceSceneMap(campaignId, scene.id, file, options)).scene;
        mergeScene(queryClient, campaignId, saved);
      }
      if (name !== scene.name) saved = (await api.updateScene(campaignId, scene.id, { name })).scene;
      return saved;
    },
    onSettled: () => {
      aborter.current = null;
      setUpload(undefined);
    },
    onSuccess: (saved) => {
      if (saved) mergeScene(queryClient, campaignId, saved);
      if (saved) onSaved(saved, scene === null);
      else onClose();
    },
  });

  const close = () => {
    aborter.current?.abort();
    onClose();
  };
  const failure = save.isError && !(save.error instanceof UploadAborted) ? errorMessage(save.error) : undefined;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }} className={dialogWide}
      title={scene ? `Editar ${scene.name}` : 'Nova cena'}
      description="O mapa só aparece para os jogadores quando você abrir a cena para a mesa.">
      <SceneForm scene={scene ?? undefined} upload={upload} serverError={failure}
        onSubmit={(input) => save.mutate(input)} onCancel={close} />
    </Dialog>
  );
}
