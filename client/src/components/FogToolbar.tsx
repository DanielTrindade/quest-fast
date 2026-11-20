import { useId, useState } from 'react';
import { Cloud, CloudSlash, Eye, Hand, Polygon, Rectangle, Warning } from '@phosphor-icons/react';
import type { FogMode } from '@quest-fast/shared';
import type { FogShapeKind, FogTool } from '../lib/fog-tool';
import { Button } from './Button';
import { checkLabel, segmentedGroup, segmentedRadio } from './ui/segmented';

type WholeMap = 'reveal' | 'hide';

const WHOLE_MAP: Record<WholeMap, { label: string; warning: string; confirm: string }> = {
  reveal: {
    label: 'Revelar tudo',
    warning: 'Os jogadores passam a ver o mapa inteiro e todos os tokens que não estão escondidos.',
    confirm: 'Revelar o mapa',
  },
  hide: {
    label: 'Ocultar tudo',
    warning: 'O que foi revelado some da tela dos jogadores, com os monstros que estão nele.',
    confirm: 'Ocultar o mapa',
  },
};

function describeAreas(areas: number): string {
  if (areas === 0) return 'Nada revelado.';
  return areas === 1 ? '1 área revelada.' : `${areas} áreas reveladas.`;
}

/**
 * The master's fog tools for the open scene: turn the fog on, pick what to
 * draw (a rectangle for rooms, a polygon for caves) and whether it reveals
 * or hides, reveal or hide the whole map after a confirmation, and look at
 * the map as the players see it. Presentational: the map draws, the screen
 * sends.
 */
export function FogToolbar({
  enabled, onEnabledChange, tool, onToolChange, areas, onWholeMap, playerView, onPlayerViewChange, busy = false, error,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** The tool in hand, or none: the map pans. */
  tool: FogTool | null;
  onToolChange: (tool: FogTool | null) => void;
  /** Revealed areas, as the scene's fog counts them. */
  areas: number;
  onWholeMap: (mode: FogMode) => void;
  /** "Ver como jogador": only on the master's screen. */
  playerView: boolean;
  onPlayerViewChange: (playerView: boolean) => void;
  /** A change on its way to the server. */
  busy?: boolean;
  /** The server's refusal of the last change. */
  error?: string;
}) {
  const name = useId();
  const [confirming, setConfirming] = useState<WholeMap | null>(null);
  const [mode, setMode] = useState<FogMode>(tool?.mode ?? 'reveal');
  const shape: FogShapeKind | 'none' = tool?.shape ?? 'none';

  const pickShape = (next: FogShapeKind | 'none') => onToolChange(next === 'none' ? null : { mode, shape: next });
  const pickMode = (next: FogMode) => {
    setMode(next);
    if (tool) onToolChange({ ...tool, mode: next });
  };

  return (
    <section aria-label="Fog of war" className="grid min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <label className={checkLabel}>
          <input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => onEnabledChange(event.target.checked)} />
          Fog ligado
        </label>
        <p className="m-0 text-small text-text-secondary" aria-live="polite">
          {enabled ? describeAreas(areas) : 'Desligado: os jogadores veem o mapa inteiro.'}
        </p>
      </div>

      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 text-small font-medium text-foreground">Desenhar no mapa</legend>
        <div className={segmentedGroup}>
          {([
            ['none', 'Mover o mapa', Hand],
            ['rect', 'Retângulo', Rectangle],
            ['polygon', 'Polígono', Polygon],
          ] as const).map(([value, label, Icon]) => (
            <label key={value} className={segmentedRadio}>
              <input type="radio" name={`${name}-shape`} value={value} checked={shape === value} onChange={() => pickShape(value)} />
              <Icon size={18} aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
        <div className={segmentedGroup} role="radiogroup" aria-label="O que a forma faz">
          {([
            ['reveal', 'Revelar', Cloud],
            ['hide', 'Ocultar', CloudSlash],
          ] as const).map(([value, label, Icon]) => (
            <label key={value} className={segmentedRadio}>
              <input type="radio" name={`${name}-mode`} value={value} checked={mode === value} onChange={() => pickMode(value)} />
              <Icon size={18} aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
        {!enabled && (
          <p className="m-0 text-small text-text-secondary">
            Dá para preparar a cena com o fog desligado; ela só fica oculta quando você ligar.
          </p>
        )}
      </fieldset>

      {confirming ? (
        <div role="group" aria-label={WHOLE_MAP[confirming].label} className="grid gap-2 rounded-control border border-border bg-background p-3">
          <p className="m-0 flex items-start gap-2 text-small text-text-secondary [&>svg]:mt-px [&>svg]:flex-none [&>svg]:text-accent-text">
            <Warning size={18} weight="fill" aria-hidden="true" />
            {WHOLE_MAP[confirming].warning}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button loading={busy} onClick={() => {
              onWholeMap(confirming);
              setConfirming(null);
            }}>{WHOLE_MAP[confirming].confirm}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming('reveal')}>
            <Cloud size={18} aria-hidden="true" /> Revelar tudo
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming('hide')}>
            <CloudSlash size={18} aria-hidden="true" /> Ocultar tudo
          </Button>
        </div>
      )}

      <label className={checkLabel}>
        <input type="checkbox" checked={playerView} onChange={(event) => onPlayerViewChange(event.target.checked)} />
        <Eye size={18} aria-hidden="true" />
        Ver como jogador
      </label>

      {error && <p role="alert" className="m-0 text-small text-danger-text">{error}</p>}
    </section>
  );
}
