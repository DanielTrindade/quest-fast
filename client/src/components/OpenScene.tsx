import type { ReactNode } from 'react';
import { Broadcast, MapTrifold } from '@phosphor-icons/react';
import type { SceneSummary } from '@quest-fast/shared';
import { EmptyState } from './EmptyState';
import { Surface } from './Surface';
import { Badge } from './ui/badge';
import { cardRowTitle } from './sheet-styles';

/**
 * The map open for the table, in short: a preview, its name and the way to
 * the table, where it is played. Without one, says so, in the master's words
 * or the player's. Presentational: the screen passes the links as `action`.
 */
export function OpenScene({ scene, isMaster, action }: {
  scene: Pick<SceneSummary, 'name' | 'mapUrl' | 'mapWidth' | 'mapHeight'> | null;
  isMaster: boolean;
  /** The way to the table with a scene; with none, the master's way to open one. */
  action?: ReactNode;
}) {
  if (!scene) {
    return (
      <Surface className="p-0">
        <EmptyState icon={MapTrifold} title="Nenhum mapa aberto"
          description={isMaster
            ? 'Abra uma cena no Preparo e o mapa aparece na Mesa, para você e para cada jogador.'
            : 'Quando o mestre abrir um mapa, ele aparece na Mesa.'}
          action={action} />
      </Surface>
    );
  }

  return (
    <Surface className="grid gap-4 @min-[560px]:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] @min-[560px]:items-center">
      <img src={scene.mapUrl} alt="" decoding="async"
        className="aspect-[3/2] w-full rounded-control border border-border bg-surface-secret object-cover" />
      <div className="grid min-w-0 justify-items-start gap-2">
        <Badge variant="accent"><Broadcast weight="fill" aria-hidden="true" />Aberto para a mesa</Badge>
        <h3 className={`m-0 ${cardRowTitle}`}>{scene.name}</h3>
        <p className="m-0 text-small text-text-secondary">
          <span className="font-mono tabular-nums">{scene.mapWidth} × {scene.mapHeight}</span> pixels
        </p>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </Surface>
  );
}
