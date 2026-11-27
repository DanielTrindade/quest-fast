import { useId, useState } from 'react';
import { CloudSlash, Eye, EyeSlash, PushPin, Trash } from '@phosphor-icons/react';
import type { AreaColor, AreaView, TokenView } from '@quest-fast/shared';
import { AREA_COLOR_LABELS, describeGeometry, mayChangeArea } from '../lib/area-tool';
import { cn } from '../lib/utils';
import { Button } from './Button';

const SWATCHES: Record<AreaColor, string> = {
  crimson: 'bg-area-crimson',
  amber: 'bg-area-amber',
  emerald: 'bg-area-emerald',
  azure: 'bg-area-azure',
  violet: 'bg-area-violet',
  slate: 'bg-area-slate',
};

export type AreaListProps = {
  areas: readonly AreaView[];
  /** The tokens of the scene, to name the one an area follows. */
  tokens: readonly TokenView[];
  viewerId: string | null;
  master: boolean;
  /** Areas the table does not get (the master's list only): hidden, under the fog, or on a token it does not see. */
  fadedIds?: ReadonlySet<string>;
  /** The master only. */
  onToggleHidden?: (areaId: string, hidden: boolean) => void;
  /** Whoever made the area, and the master; in two steps. */
  onRemove?: (areaId: string) => void;
  /** Areas with a request on the way. */
  busyIds?: ReadonlySet<string>;
};

function RemoveArea({ area, busy, onRemove }: { area: AreaView; busy: boolean; onRemove: (areaId: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
        <Trash size={18} aria-hidden="true" /> Remover<span className="sr-only"> {area.name}</span>
      </Button>
    );
  }
  return (
    <span role="group" aria-label={`Remover ${area.name} do mapa?`}
      className="flex max-w-full min-w-0 flex-wrap items-center gap-2 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
      <Button variant="danger" disabled={busy} onClick={() => onRemove(area.id)}>Remover {area.name}</Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>Manter</Button>
    </span>
  );
}

function AreaRow({ area, anchor, own, master, faded, busy, onToggleHidden, onRemove, viewerId }: {
  area: AreaView;
  anchor: TokenView | undefined;
  own: boolean;
  master: boolean;
  faded: boolean;
  busy: boolean;
  viewerId: string | null;
} & Pick<AreaListProps, 'onToggleHidden' | 'onRemove'>) {
  const removable = onRemove && mayChangeArea(area, { id: viewerId, master });
  return (
    <li className={cn(
      'grid min-w-0 gap-2 rounded-panel border border-border bg-card p-2',
      (area.hidden || faded) && 'border-dashed bg-surface-secret',
    )}>
      <div className="flex min-h-11 min-w-0 items-center gap-3 px-1">
        <span aria-hidden="true" className={cn('size-4 flex-none rounded-full', SWATCHES[area.tint])} />
        <span className="grid min-w-0 gap-0.5">
          <span className="font-semibold [overflow-wrap:anywhere] text-foreground">
            {area.name}<span className="sr-only">, {AREA_COLOR_LABELS[area.tint]}</span>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-small text-text-secondary [&>span]:inline-flex [&>span]:min-w-0 [&>span]:items-center [&>span]:gap-1 [&>span]:[overflow-wrap:anywhere] [&_svg]:shrink-0">
            <span>{describeGeometry(area)}</span>
            {anchor && <span><PushPin size={14} aria-hidden="true" /> Segue {anchor.name}</span>}
            <span>{own ? <span className="font-semibold text-accent-text">Sua área</span> : `De ${area.createdBy.name}`}</span>
            {area.hidden && <span><EyeSlash size={14} aria-hidden="true" /> Oculta</span>}
            {!area.hidden && faded && <span><CloudSlash size={14} aria-hidden="true" /> A mesa não vê</span>}
          </span>
        </span>
      </div>
      {(onToggleHidden || removable) && (
        <div className="flex flex-wrap items-center gap-1 *:max-w-full">
          {onToggleHidden && (
            <Button variant="ghost" disabled={busy} onClick={() => onToggleHidden(area.id, !area.hidden)}>
              {area.hidden ? <Eye size={18} aria-hidden="true" /> : <EyeSlash size={18} aria-hidden="true" />}
              {area.hidden ? 'Revelar' : 'Ocultar'}
              <span className="sr-only"> {area.name}</span>
            </Button>
          )}
          {removable && <RemoveArea area={area} busy={busy} onRemove={onRemove} />}
        </div>
      )}
    </li>
  );
}

/**
 * The persistent areas of the scene in DOM: the accessible side of what the
 * map draws. Each row says the shape, its size, who made it and the token it
 * follows; whoever made it removes it, and the master also hides and reveals
 * any of them. Presentational: the screen does the requests.
 */
export function AreaList({ areas, tokens, viewerId, master, fadedIds, onToggleHidden, onRemove, busyIds }: AreaListProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 content-start gap-2">
      <h2 id={headingId} className="m-0 flex items-baseline gap-2 font-display text-h2 font-semibold">
        Áreas <span className="font-sans text-small font-normal text-text-secondary tabular-nums">{areas.length}</span>
      </h2>
      {areas.length === 0 ? (
        <p className="m-0 text-small text-text-secondary">Nenhuma área na cena. Desenhe uma para marcar uma magia no mapa.</p>
      ) : (
        <ul className="m-0 grid max-h-[min(40vh,24rem)] min-w-0 list-none gap-2 overflow-y-auto overscroll-contain p-1">
          {areas.map((area) => (
            <AreaRow key={area.id} area={area} viewerId={viewerId} master={master}
              anchor={area.anchorTokenId ? tokens.find((token) => token.id === area.anchorTokenId) : undefined}
              own={viewerId !== null && area.createdBy.userId === viewerId}
              faded={fadedIds?.has(area.id) ?? false}
              busy={busyIds?.has(area.id) ?? false}
              onToggleHidden={master ? onToggleHidden : undefined} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}
