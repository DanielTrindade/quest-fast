import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { GridSettings as Grid } from '@quest-fast/shared';
import { GridSettings } from '../components/GridSettings';
import { MapCanvas } from '../components/MapCanvas';
import { PRINTED_CELL, PRINTED_OFFSET, SYNTHETIC_MAP, defaultSceneGrid, syntheticMapUrl } from './fixtures/maps';

/** The settings beside the map they preview, as on the master's map screen. */
function WithPreview(props: Parameters<typeof GridSettings>[0]) {
  const [preview, setPreview] = useState<Grid>(props.grid);
  return (
    <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-[360px] min-w-0">
        <MapCanvas imageUrl={syntheticMapUrl()} mapWidth={props.mapWidth} mapHeight={props.mapHeight} grid={preview} label="Salão em ruínas" />
      </div>
      <GridSettings {...props} onPreview={(grid) => { setPreview(grid); props.onPreview(grid); }} />
    </div>
  );
}

const meta = {
  title: 'Componentes/GridSettings',
  component: GridSettings,
  args: {
    grid: defaultSceneGrid,
    mapWidth: SYNTHETIC_MAP.width,
    mapHeight: SYNTHETIC_MAP.height,
    onPreview: fn(),
    onSave: fn(),
  },
  render: (args) => <WithPreview {...args} />,
} satisfies Meta<typeof GridSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const AlinharAoDesenho: Story = {
  name: 'Alinhar ao grid do desenho',
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    const save = form.getByRole('button', { name: 'Salvar grid' });
    await expect(save).toBeDisabled();

    await userEvent.clear(form.getByLabelText('Casa (pixels)'));
    await userEvent.type(form.getByLabelText('Casa (pixels)'), String(PRINTED_CELL));
    await expect(form.getByLabelText('Casas de largura')).toHaveValue(String(SYNTHETIC_MAP.width / PRINTED_CELL));
    for (const label of ['Deslocamento horizontal', 'Deslocamento vertical']) {
      await userEvent.clear(form.getByLabelText(label));
      await userEvent.type(form.getByLabelText(label), String(PRINTED_OFFSET));
    }
    await waitFor(() => expect(args.onPreview).toHaveBeenLastCalledWith(
      { enabled: true, snap: true, cellSize: PRINTED_CELL, offsetX: PRINTED_OFFSET, offsetY: PRINTED_OFFSET },
    ));
    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledWith(
      { enabled: true, snap: true, cellSize: PRINTED_CELL, offsetX: PRINTED_OFFSET, offsetY: PRINTED_OFFSET },
    );
  },
};

export const ForaDoMapa: Story = {
  name: 'Valores fora do mapa',
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    await userEvent.clear(form.getByLabelText('Casas de largura'));
    await userEvent.type(form.getByLabelText('Casas de largura'), '500');
    await expect(form.getByText(/Use de 1 a 225 casas/)).toBeVisible();
    await userEvent.clear(form.getByLabelText('Deslocamento horizontal'));
    await userEvent.type(form.getByLabelText('Deslocamento horizontal'), '-3');
    await expect(form.getByText(/dentro de uma casa/)).toBeVisible();
    await expect(form.getByRole('button', { name: 'Salvar grid' })).toBeDisabled();
    await userEvent.click(form.getByRole('button', { name: 'Desfazer' }));
    await expect(form.getByLabelText('Casas de largura')).toHaveValue('30');
    await expect(args.onPreview).toHaveBeenLastCalledWith(defaultSceneGrid);
  },
};

export const CasaFracionada: Story = {
  name: 'Casa com vírgula',
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    await userEvent.clear(form.getByLabelText('Casa (pixels)'));
    await userEvent.type(form.getByLabelText('Casa (pixels)'), '62,5');
    await expect(form.getByLabelText('Casas de largura')).toHaveValue('28,8');
    await expect(args.onPreview).toHaveBeenLastCalledWith({ ...defaultSceneGrid, cellSize: 62.5 });
  },
};

export const SemGrid: Story = {
  name: 'Sem grid',
  args: { grid: { ...defaultSceneGrid, enabled: false } },
};

export const Salvando: Story = {
  args: { saving: true },
};

export const CasasInvalidas: Story = {
  name: 'Casas de largura inválidas',
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    const columns = form.getByLabelText('Casas de largura');
    const save = form.getByRole('button', { name: 'Salvar grid' });
    for (const [text, message] of [
      ['', /Informe quantas casas/],
      ['0', /Use de 1 a 225 casas/],
      ['-2', /Use de 1 a 225 casas/],
      ['abc', /Informe quantas casas/],
      // Typed one key at a time: "2" and "22" are valid on the way, so the
      // preview may move before "226" is refused.
      ['226', /Use de 1 a 225 casas/],
    ] as const) {
      await userEvent.clear(columns);
      if (text) await userEvent.type(columns, text);
      await expect(form.getByText(message)).toBeVisible();
      await expect(columns).toHaveAttribute('aria-invalid', 'true');
      await expect(save).toBeDisabled();
    }
    // The last preview is the last valid count, never the refused one.
    await expect(args.onPreview).toHaveBeenLastCalledWith({ ...defaultSceneGrid, cellSize: 1800 / 22 });
  },
};
