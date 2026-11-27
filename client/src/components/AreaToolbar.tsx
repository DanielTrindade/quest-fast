import { useId } from 'react';
import { Circle, Cylinder, Hand, LineSegment, PushPin, Ruler, Square, Triangle, Warning } from '@phosphor-icons/react';
import { AREA_COLORS, AREA_LIMITS, AREA_SHAPES, formatMeters, type AreaColor } from '@quest-fast/shared';
import { AREA_COLOR_LABELS, AREA_SHAPE_LABELS, AREA_SIZES, AREA_SIZE_LABELS, aims, type AreaDraft } from '../lib/area-tool';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Field } from './Field';
import { SelectField } from './SelectField';
import { checkLabel, segmentedGroup, segmentedRadio } from './ui/segmented';

const SHAPE_ICONS = { sphere: Circle, cylinder: Cylinder, cone: Triangle, line: LineSegment, cube: Square } as const;

/** Background utilities of the palette, written out so Tailwind finds them. */
const SWATCHES: Record<AreaColor, string> = {
  crimson: 'bg-area-crimson',
  amber: 'bg-area-amber',
  emerald: 'bg-area-emerald',
  azure: 'bg-area-azure',
  violet: 'bg-area-violet',
  slate: 'bg-area-slate',
};

const MODES = [
  ['reference', 'Referência', Ruler],
  ['persistent', 'Fica na cena', PushPin],
] as const;

type Change = (changes: Partial<AreaDraft>) => void;

function ModePicker({ draft, set, name }: { draft: AreaDraft; set: Change; name: string }) {
  return (
    <>
      <div className={segmentedGroup} role="radiogroup" aria-label="Tipo de área">
        {MODES.map(([value, label, Icon]) => (
          <label key={value} className={segmentedRadio}>
            <input type="radio" name={`${name}-mode`} value={value} checked={draft.mode === value} onChange={() => set({ mode: value })} />
            <Icon size={18} aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
      <p className="m-0 text-small text-text-secondary">
        {draft.mode === 'persistent'
          ? 'A área fica no mapa para a mesa até alguém removê-la.'
          : 'A mesa vê a área enquanto você desenha; ela some alguns segundos depois de soltar.'}
      </p>
    </>
  );
}

function ShapePicker({ draft, set, name }: { draft: AreaDraft; set: Change; name: string }) {
  return (
    <>
      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 text-small font-medium text-foreground">Forma</legend>
        <div className={segmentedGroup}>
          {AREA_SHAPES.map((shape) => {
            const Icon = SHAPE_ICONS[shape];
            return (
              <label key={shape} className={segmentedRadio}>
                <input type="radio" name={`${name}-shape`} value={shape} checked={draft.shape === shape} onChange={() => set({ shape })} />
                <Icon size={18} aria-hidden="true" />
                {AREA_SHAPE_LABELS[shape]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
        <SelectField label={AREA_SIZE_LABELS[draft.shape]} value={String(draft.size)} onChange={(value) => set({ size: Number(value) })}>
          {AREA_SIZES.map((size) => <option key={size} value={size}>{formatMeters(size)}</option>)}
        </SelectField>
        {draft.shape === 'line' && (
          <SelectField label="Largura" value={String(draft.width)} onChange={(value) => set({ width: Number(value) })}>
            {AREA_SIZES.filter((size) => size <= 6).map((size) => <option key={size} value={size}>{formatMeters(size)}</option>)}
          </SelectField>
        )}
      </div>
    </>
  );
}

/** What a persistent area is saved with: its name, its colour and, for the master, whether the table sees it. */
function PersistentFields({ draft, set, name, master }: { draft: AreaDraft; set: Change; name: string; master: boolean }) {
  return (
    <>
      <Field label="Nome da área" value={draft.name} maxLength={AREA_LIMITS.name} placeholder="Teia, Névoa Obscurecente…"
        onChange={(event) => set({ name: event.target.value })} />
      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 text-small font-medium text-foreground">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {AREA_COLORS.map((tint) => (
            <label key={tint} className={cn(
              'relative grid size-11 cursor-pointer place-items-center rounded-full border border-border',
              'has-checked:border-foreground has-checked:edge-raised has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring [&>input]:sr-only',
            )}>
              <input type="radio" name={`${name}-tint`} value={tint} checked={draft.tint === tint} onChange={() => set({ tint })} />
              <span aria-hidden="true" className={cn('size-6 rounded-full', SWATCHES[tint])} />
              <span className="sr-only">{AREA_COLOR_LABELS[tint]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {master && (
        <label className={checkLabel}>
          <input type="checkbox" checked={draft.hidden} onChange={(event) => set({ hidden: event.target.checked })} />
          Oculta para a mesa
        </label>
      )}
    </>
  );
}

type ToolbarProps = {
  draft: AreaDraft;
  onDraftChange: (draft: AreaDraft) => void;
  /** The tool in hand: the map draws instead of panning. */
  drawing: boolean;
  onDrawingChange: (drawing: boolean) => void;
  master: boolean;
  /** The selected token the viewer may anchor an area on, by name; none otherwise. */
  anchor?: string | null;
  /** Saves the persistent area on the selected token. */
  onAnchor?: () => void;
  busy?: boolean;
  /** The server's refusal of the last area. */
  error?: string;
};

/** Drawing on the map, or following the selected token, and what to do next. */
function DrawActions({ draft, drawing, onDrawingChange, anchor, onAnchor, busy }: Omit<ToolbarProps, 'onDraftChange' | 'master' | 'error'>) {
  const persistent = draft.mode === 'persistent';
  const named = draft.name.trim().length > 0;
  const canAnchor = persistent && !aims(draft.shape) && Boolean(anchor) && onAnchor !== undefined;
  return (
    <>
      <div className="flex min-w-0 flex-wrap gap-2">
        {drawing ? (
          <Button variant="secondary" onClick={() => onDrawingChange(false)}>
            <Hand size={18} aria-hidden="true" /> Voltar a mover o mapa
          </Button>
        ) : (
          <Button disabled={busy || (persistent && !named)} onClick={() => onDrawingChange(true)}>
            <Ruler size={18} aria-hidden="true" /> Desenhar no mapa
          </Button>
        )}
        {canAnchor && (
          <Button variant="secondary" disabled={busy || !named} loading={busy} onClick={onAnchor}
            className="h-auto min-h-10 max-w-full whitespace-normal text-left [overflow-wrap:anywhere]">
            <PushPin size={18} aria-hidden="true" /> Seguir {anchor}
          </Button>
        )}
      </div>
      {persistent && !named && <p className="m-0 text-small text-text-muted">Dê um nome antes de pôr a área na cena.</p>}
      {drawing && (
        <p className="m-0 text-small text-text-secondary" aria-live="polite">
          {aims(draft.shape) ? 'Pressione onde a área começa e arraste para apontá-la.' : 'Pressione e arraste para pôr o centro da área.'}
        </p>
      )}
    </>
  );
}

/**
 * The area templates of the map (#113): pick a shape and its size, then draw
 * it on the map. A reference area is for the table to see while it is drawn
 * and goes a moment later; a persistent one stays on the scene with a name
 * and a colour, or follows the selected token (an emanation, as Espírito
 * Guardião). Presentational: the map draws, the screen sends.
 */
export function AreaToolbar({ draft, onDraftChange, master, error, ...actions }: ToolbarProps) {
  const name = useId();
  const set: Change = (changes) => onDraftChange({ ...draft, ...changes });
  return (
    <section aria-label="Áreas" className="grid min-w-0 gap-3">
      <ModePicker draft={draft} set={set} name={name} />
      <ShapePicker draft={draft} set={set} name={name} />
      {draft.mode === 'persistent' && <PersistentFields draft={draft} set={set} name={name} master={master} />}
      <DrawActions draft={draft} {...actions} />
      {error && (
        <p role="alert" className="m-0 flex items-start gap-2 text-small text-danger-text [&>svg]:mt-px [&>svg]:flex-none">
          <Warning size={18} weight="fill" aria-hidden="true" /> {error}
        </p>
      )}
    </section>
  );
}
