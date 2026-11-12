import { useRef, useState, type FormEvent } from 'react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { cellSizeFromColumns, maxGridColumns, validateGrid, type GridSettings as Grid } from '@quest-fast/shared';
import { gridCells } from '../lib/map-view';
import { Button } from './Button';
import { Field } from './Field';
import { checkLabel } from './ui/segmented';

type Draft = { enabled: boolean; snap: boolean; columns: string; cellSize: string; offsetX: string; offsetY: string };

/** Two decimals at most, with the decimal comma the table writes. */
const show = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');

function draftOf(grid: Grid, mapWidth: number): Draft {
  return {
    enabled: grid.enabled,
    snap: grid.snap,
    columns: show(mapWidth / grid.cellSize),
    cellSize: show(grid.cellSize),
    offsetX: show(grid.offsetX),
    offsetY: show(grid.offsetY),
  };
}

/** Accepts "12,5" and "12.5"; anything else is not a number. */
const parse = (text: string) => {
  const clean = text.trim().replace(',', '.');
  return /^-?\d+(\.\d*)?$/.test(clean) ? Number(clean) : Number.NaN;
};

/** The grid a draft describes, and why it does not fit the map when it does not. */
function read(draft: Draft, mapWidth: number) {
  const grid: Grid = {
    enabled: draft.enabled,
    snap: draft.snap,
    cellSize: parse(draft.cellSize),
    offsetX: parse(draft.offsetX),
    offsetY: parse(draft.offsetY),
  };
  return { grid, errors: validateGrid(grid, mapWidth) };
}

/**
 * The scene's grid. The master says how many cells the map has across (the
 * cell size follows, or the other way round, for a map whose drawn grid does
 * not divide its width) and shifts it to match the grid drawn on the image.
 * Every valid change goes to `onPreview`, for the map beside it; nothing is
 * saved until "Salvar grid".
 */
export function GridSettings({ grid, mapWidth, mapHeight, onPreview, onSave, saving = false, serverError }: {
  /** The saved grid. */
  grid: Grid;
  mapWidth: number;
  mapHeight: number;
  onPreview: (grid: Grid) => void;
  onSave: (grid: Grid) => void;
  saving?: boolean;
  serverError?: string;
}) {
  const [draft, setDraft] = useState(() => draftOf(grid, mapWidth));
  // Keystrokes can arrive faster than renders: each one builds on the latest
  // draft, not on the one its handler was rendered with.
  const latest = useRef(draft);
  const { grid: next, errors } = read(draft, mapWidth);
  const valid = Object.keys(errors).length === 0;
  const changed = JSON.stringify(draftOf(grid, mapWidth)) !== JSON.stringify(draft);
  const maxColumns = maxGridColumns(mapWidth);
  const columns = parse(draft.columns);
  const columnsError = errors.cellSize && Number.isFinite(columns)
    ? `Use de 1 a ${maxColumns} casas de largura.`
    : errors.cellSize && 'Informe quantas casas o mapa tem de largura.';

  const update = (changes: Partial<Draft>) => {
    const updated = { ...latest.current, ...changes };
    latest.current = updated;
    setDraft(updated);
    const result = read(updated, mapWidth);
    if (Object.keys(result.errors).length === 0) onPreview(result.grid);
  };

  const onColumns = (text: string) => {
    const count = parse(text);
    update({ columns: text, ...(count > 0 ? { cellSize: show(cellSizeFromColumns(mapWidth, count)) } : {}) });
  };

  const onCellSize = (text: string) => {
    const size = parse(text);
    update({ cellSize: text, ...(size > 0 ? { columns: show(mapWidth / size) } : {}) });
  };

  const reset = () => {
    latest.current = draftOf(grid, mapWidth);
    setDraft(latest.current);
    onPreview(grid);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid && changed) onSave(next);
  };

  const cells = valid ? gridCells(next, { width: mapWidth, height: mapHeight }) : null;

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit} noValidate aria-label="Grid do mapa">
      <label className={checkLabel}>
        <input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => update({ enabled: event.target.checked })} />
        Mostrar o grid
      </label>

      <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0" disabled={!draft.enabled || saving}>
        <legend className="sr-only">Tamanho e posição do grid</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
          <Field label="Casas de largura" inputMode="decimal" autoComplete="off"
            value={draft.columns} error={columnsError || undefined} onChange={(event) => onColumns(event.target.value)} />
          <Field label="Casa (pixels)" inputMode="decimal" autoComplete="off"
            value={draft.cellSize} onChange={(event) => onCellSize(event.target.value)} aria-invalid={errors.cellSize ? true : undefined} />
          <Field label="Deslocamento horizontal" hint="Em pixels do mapa" inputMode="decimal" autoComplete="off"
            value={draft.offsetX} error={errors.offsetX} onChange={(event) => update({ offsetX: event.target.value })} />
          <Field label="Deslocamento vertical" hint="Em pixels do mapa" inputMode="decimal" autoComplete="off"
            value={draft.offsetY} error={errors.offsetY} onChange={(event) => update({ offsetY: event.target.value })} />
        </div>
        <label className={checkLabel}>
          <input type="checkbox" checked={draft.snap} onChange={(event) => update({ snap: event.target.checked })} />
          Encaixar os tokens no centro das casas
        </label>
      </fieldset>

      <p className="m-0 text-small text-text-secondary" aria-live="polite">
        {!draft.enabled
          ? 'Sem grid: bom para mapas que já trazem o grid desenhado.'
          : cells
            ? <>Grid de <span className="font-mono tabular-nums">{cells.columns} × {cells.rows}</span> casas.</>
            : 'Corrija os campos para ver o grid no mapa.'}
      </p>

      {serverError && <p role="alert" className="m-0 text-small text-danger-text">{serverError}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={!changed || saving} onClick={reset}>
          <ArrowCounterClockwise size={18} aria-hidden="true" /> Desfazer
        </Button>
        <Button type="submit" loading={saving} disabled={!valid || !changed}>Salvar grid</Button>
      </div>
    </form>
  );
}
