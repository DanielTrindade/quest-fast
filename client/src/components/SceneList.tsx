import { useState } from 'react';
import { Broadcast, Eye, MapTrifold, PencilSimple, Plus, Trash, Warning, XCircle } from '@phosphor-icons/react';
import type { SceneSummary } from '@quest-fast/shared';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Badge } from './ui/badge';
import { cardRowTitle } from './sheet-styles';

/**
 * The master's scenes, newest first. Opening a scene for the table puts it on
 * every player's screen; only one is open at a time. Deleting asks first,
 * naming what the table loses. Presentational: every action is a callback,
 * and `pendingSceneId` holds the row whose action is on its way.
 */
export function SceneList({ scenes, onCreate, onView, onOpenForTable, onCloseTable, onEdit, onDelete, pendingSceneId }: {
  scenes: SceneSummary[];
  onCreate: () => void;
  onView: (sceneId: string) => void;
  onOpenForTable: (sceneId: string) => void;
  onCloseTable: () => void;
  onEdit: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  pendingSceneId?: string;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (scenes.length === 0) {
    return (
      <EmptyState icon={MapTrifold} title="Nenhuma cena ainda"
        description="Envie o mapa de um lugar da aventura. Ele só aparece para os jogadores quando você abrir a cena para a mesa."
        action={<Button onClick={onCreate}><Plus size={18} aria-hidden="true" /> Criar cena</Button>} />
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <Button onClick={onCreate}><Plus size={18} aria-hidden="true" /> Criar cena</Button>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0" aria-label="Cenas">
        {scenes.map((scene) => {
          const pending = pendingSceneId === scene.id;
          return (
            <li key={scene.id} data-slot="scene-row" data-active={scene.active}
              className="grid gap-3 rounded-panel border border-border bg-card p-3 edge-raised data-[active=true]:border-accent-text data-[active=true]:shadow-[inset_3px_0_0_var(--color-accent-text)]">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <img src={scene.mapUrl} alt="" loading="lazy" decoding="async"
                  className="aspect-[3/2] w-24 flex-none rounded-control border border-border bg-surface-secret object-cover" />
                <div className="grid min-w-0 flex-[1_1_10rem] gap-1">
                  <h3 className={`m-0 ${cardRowTitle}`}>{scene.name}</h3>
                  <p className="m-0 text-small text-text-secondary">
                    <span className="font-mono tabular-nums">{scene.mapWidth} × {scene.mapHeight}</span> pixels
                  </p>
                  {scene.active && (
                    <Badge variant="accent"><Broadcast weight="fill" aria-hidden="true" />Aberta para a mesa</Badge>
                  )}
                </div>
              </div>

              {confirming === scene.id ? (
                <div role="group" aria-label={`Excluir ${scene.name}`} className="grid gap-2 rounded-control border border-border bg-background p-3">
                  <p className="m-0 flex items-start gap-2 text-small text-danger-text [&>svg]:mt-px [&>svg]:flex-none">
                    <Warning size={18} weight="fill" aria-hidden="true" />
                    {scene.active
                      ? 'A cena sai da lista e da tela dos jogadores, que ficam sem mapa.'
                      : 'A cena e o mapa saem da lista. Não dá para desfazer.'}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => setConfirming(null)}>Cancelar</Button>
                    <Button variant="danger" loading={pending} onClick={() => onDelete(scene.id)}>Excluir cena</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {scene.active ? (
                    <Button variant="secondary" loading={pending} onClick={onCloseTable}>
                      <XCircle size={18} aria-hidden="true" /> Fechar para a mesa
                    </Button>
                  ) : (
                    <Button variant="secondary" loading={pending} onClick={() => onOpenForTable(scene.id)}>
                      <Broadcast size={18} aria-hidden="true" /> Abrir para a mesa
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => onView(scene.id)} aria-label={`Ver mapa de ${scene.name}`}>
                    <Eye size={18} aria-hidden="true" /> Ver mapa
                  </Button>
                  <Button variant="ghost" onClick={() => onEdit(scene.id)} aria-label={`Editar ${scene.name}`}>
                    <PencilSimple size={18} aria-hidden="true" /> Editar
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => setConfirming(scene.id)} aria-label={`Excluir ${scene.name}`}>
                    <Trash size={18} aria-hidden="true" /> Excluir
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
