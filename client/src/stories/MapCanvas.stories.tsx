import { StrictMode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MapCanvas } from '../components/MapCanvas';
import { SYNTHETIC_MAP, alignedSceneGrid, defaultSceneGrid, syntheticMapUrl } from './fixtures/maps';

const meta = {
  title: 'Componentes/MapCanvas',
  component: MapCanvas,
  args: {
    imageUrl: '',
    mapWidth: SYNTHETIC_MAP.width,
    mapHeight: SYNTHETIC_MAP.height,
    grid: defaultSceneGrid,
    label: 'Salão em ruínas',
  },
  // The map is drawn on load, so the story is never handed a table's map.
  render: (args) => <MapCanvas {...args} imageUrl={args.imageUrl || syntheticMapUrl()} />,
  decorators: [(Story) => <div className="h-[420px] min-w-0"><Story /></div>],
} satisfies Meta<typeof MapCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;

async function readyMap(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  const frame = within(region).getByRole('group', { name: 'Salão em ruínas' });
  await waitFor(() => expect(frame).toHaveAttribute('data-status', 'ready'));
  return { frame, map: within(frame) };
}

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    const zoom = () => map.getByText(/\d+%$/).textContent;
    const framed = await waitFor(zoom);

    await userEvent.click(map.getByRole('button', { name: 'Aproximar' }));
    await waitFor(() => expect(zoom()).not.toBe(framed));

    await userEvent.click(map.getByRole('button', { name: 'Enquadrar o mapa' }));
    await waitFor(() => expect(zoom()).toBe(framed));

    frame.focus();
    await userEvent.keyboard('-');
    await waitFor(() => expect(zoom()).not.toBe(framed));
    await userEvent.keyboard('0');
    await waitFor(() => expect(zoom()).toBe(framed));
  },
};

export const GridAlinhado: Story = {
  name: 'Grid alinhado ao desenho',
  args: { grid: alignedSceneGrid },
};

export const SemGrid: Story = {
  name: 'Sem grid',
  args: { grid: { ...defaultSceneGrid, enabled: false } },
  play: async ({ canvasElement }) => {
    const { map } = await readyMap(canvasElement);
    await expect(map.getByText(/Sem grid\./)).toBeInTheDocument();
  },
};

export const Retrato: Story = {
  name: 'Mapa em pé',
  args: { mapWidth: SYNTHETIC_MAP.height, mapHeight: SYNTHETIC_MAP.width, grid: { ...defaultSceneGrid, cellSize: SYNTHETIC_MAP.height / 20 } },
};

export const Erro: Story = {
  name: 'Falha ao carregar',
  args: { imageUrl: '/mapa-que-nao-existe.jpg' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const map = within(region);
    await waitFor(() => expect(map.getByText('Não foi possível carregar o mapa.')).toBeVisible());
    await expect(map.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  },
};

/** Whether the canvas has the map painted at its centre. */
function painted(frame: HTMLElement): boolean {
  const canvas = frame.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return false;
  return context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3] > 0;
}

export const ModoEstrito: Story = {
  name: 'StrictMode',
  // The app's root runs under StrictMode, which runs every effect twice.
  decorators: [(Story) => <StrictMode><Story /></StrictMode>],
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    await waitFor(() => expect(painted(frame)).toBe(true));
    await userEvent.click(map.getByRole('button', { name: 'Aproximar' }));
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};
