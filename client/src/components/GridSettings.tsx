import { useRef, useState, type FormEvent } from 'react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { SCENE_LIMITS, cellSizeFromColumns, maxGridColumns, validateGrid, type GridFieldErrors, type GridSettings as Grid } from '@quest-fast/shared';
import { gridCells } from '../lib/map-view';
import { Button } from './Button';
import { Field } from './Field';
import { checkLabel } from './ui/segmented';

type Draft = {
  enabled: boolean;
  snap: boolean;
  columns: string;
  cellSize: string;
  /**
   * The cell size in effect, unrounded: the fields show two decimals, but 22
   * columns on a 1800 px map are 1800 / 22 px, not 81.82. NaN while invalid.
   */
  exact: number;
  /**
   * The size field the master typed in; the other one is derived from it.
   * A refusal belongs to the field typed, never to the derived one.
   */
  source: 'columns' | 'cellSize';
  offsetX: string;
  offsetY: string;
};

/** Two decimals at most, with the decimal comma the table writes. */
const show = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');

function draftOf(grid: Grid, mapWidth: number): Draft {
  return {
    enabled: grid.enabled,
    snap: grid.snap,
    columns: show(mapWidth / grid.cellSize),
    cellSize: show(grid.cellSize),
    exact: grid.cellSize,
    source: 'cellSize',
    offsetX: show(grid.offsetX),
    offsetY: show(grid.offsetY),
  };
}

/** Accepts "12,5" and "12.5"; anything else is not a number. */
const parse = (text: string) => {
  const clean = text.trim().replace(',', '.');
  return /^-?\d+(\.\d*)?$/.test(clean) ? Number(clean) : Number.NaN;
};

type DraftErrors = GridFieldErrors & { columns?: string };

/**
 * The grid a draft describes, and why it does not fit the map when it does
 * not. When the master typed the columns, they are checked on their own and
 * carry the refusal. Their bound is the real one, the map's width over the
 * smallest cell, not a whole count: 225.13 columns of 8 px fit 1801 px.
 */
function read(draft: Draft, mapWidth: number): { grid: Grid; errors: DraftErrors } {
  const grid: Grid = {
    enabled: draft.enabled,
    snap: draft.snap,
    cellSize: draft.exact,
    offsetX: parse(draft.offsetX),
    offsetY: parse(draft.offsetY),
  };
  const errors: DraftErrors = validateGrid(grid, mapWidth);
  if (draft.source !== 'columns') return { grid, errors };
  const columns = parse(draft.columns);
  if (!Number.isFinite(columns)) errors.columns = 'Informe quantas casas o mapa tem de largura.';
  else if (columns < 1 || columns > mapWidth / SCENE_LIMITS.minCellSize) {
    errors.columns = `Use de 1 a ${maxGridColumns(mapWidth)} casas de largura.`;
  }
  if (errors.columns) delete errors.cellSize;
  return { grid, errors };
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
  // Which field was typed last is not a change of the grid.
  const changed = JSON.stringify(draftOf(grid, mapWidth)) !== JSON.stringify({ ...draft, source: 'cellSize' });

  const update = (changes: Partial<Draft>) => {
    const updated = { ...latest.current, ...changes };
    latest.current = updated;
    setDraft(updated);
    const result = read(updated, mapWidth);
    if (Object.keys(result.errors).length === 0) onPreview(result.grid);
  };

  const onColumns = (text: string) => {
    const count = parse(text);
    const exact = count > 0 ? cellSizeFromColumns(mapWidth, count) : Number.NaN;
    update({ columns: text, exact, source: 'columns', ...(count > 0 ? { cellSize: show(exact) } : {}) });
  };

  const onCellSize = (text: string) => {
    const size = parse(text);
    update({ cellSize: text, exact: size, source: 'cellSize', ...(size > 0 ? { columns: show(mapWidth / size) } : {}) });
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
            value={draft.columns} error={errors.columns} onChange={(event) => onColumns(event.target.value)} />
          <Field label="Casa (pixels)" inputMode="decimal" autoComplete="off"
            value={draft.cellSize} error={errors.cellSize} onChange={(event) => onCellSize(event.target.value)} />
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
