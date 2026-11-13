import { StrictMode, useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { TokenView } from '@quest-fast/shared';
import { MapCanvas, type MapCanvasProps } from '../components/MapCanvas';
import { fitView } from '../lib/map-view';
import { canMoveToken } from '../lib/token-labels';
import { createMotionStore } from '../lib/token-motion';
import { PRINTED_CELL, SYNTHETIC_MAP, alignedSceneGrid, defaultSceneGrid, syntheticMapUrl } from './fixtures/maps';
import { MASTER_ID, PLAYER_ID, manyTokens, masterTokens, playerTokens } from './fixtures/tokens';

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

// --- Tokens ---------------------------------------------------------------

/** Where a map point is on the page, with the map framed as it loads. */
function onPage(frame: HTMLElement, point: { x: number; y: number }) {
  const rect = frame.querySelector('canvas')!.getBoundingClientRect();
  const view = fitView(SYNTHETIC_MAP, { width: rect.width, height: rect.height });
  return { clientX: rect.left + view.x + point.x * view.scale, clientY: rect.top + view.y + point.y * view.scale };
}

async function dragOnMap(frame: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  const canvas = frame.querySelector('canvas')!;
  const start = onPage(frame, from);
  const end = onPage(frame, to);
  const steps = [0.25, 0.5, 0.75, 1].map((t) => ({
    coords: { clientX: start.clientX + (end.clientX - start.clientX) * t, clientY: start.clientY + (end.clientY - start.clientY) * t },
  }));
  await userEvent.pointer([{ keys: '[MouseLeft>]', target: canvas, coords: start }, ...steps, { keys: '[/MouseLeft]' }]);
}

/** The map with selection kept in the story, as the screen keeps it. */
function TokenMap(props: MapCanvasProps & { master: boolean }) {
  const { master, viewerId = null, onSelect } = props;
  const [selected, setSelected] = useState<string | null>(props.selectedTokenId ?? null);
  return (
    <MapCanvas {...props} imageUrl={props.imageUrl || syntheticMapUrl()} selectedTokenId={selected}
      canMove={(token: TokenView) => canMoveToken(token, viewerId, master)}
      onSelect={(id) => {
        setSelected(id);
        onSelect?.(id);
      }} />
  );
}

const tokenArgs = {
  grid: alignedSceneGrid,
  onSelect: fn(),
  onGrab: fn(),
  onDrag: fn(),
  onDrop: fn(),
};

export const TokensMestre: Story = {
  name: 'Tokens (mestre)',
  args: { ...tokenArgs, tokens: masterTokens(), viewerId: MASTER_ID, selectedTokenId: 'ogre' },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement, args }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/7 tokens no mapa\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));

    // A goblin dragged three cells to the right rests on that cell's centre.
    const goblin = masterTokens().find((token) => token.id === 'goblin-1')!;
    await dragOnMap(frame, goblin, { x: goblin.x + PRINTED_CELL * 3 + 7, y: goblin.y - 11 });
    await expect(args.onGrab).toHaveBeenCalledWith('goblin-1');
    await expect(args.onDrag).toHaveBeenCalled();
    await expect(args.onDrop).toHaveBeenCalledWith('goblin-1', goblin.x + PRINTED_CELL * 3, goblin.y);
    await expect(args.onSelect).toHaveBeenCalledWith('goblin-1');
  },
};

export const TokensJogador: Story = {
  name: 'Tokens (jogador)',
  args: { ...tokenArgs, tokens: playerTokens(), viewerId: PLAYER_ID },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement, args }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/6 tokens no mapa\./)).toBeInTheDocument();

    // Someone else's token only gets selected: the press pans the map.
    const goblin = playerTokens().find((token) => token.id === 'goblin-1')!;
    await dragOnMap(frame, goblin, { x: goblin.x + PRINTED_CELL * 2, y: goblin.y });
    await expect(args.onSelect).toHaveBeenCalledWith('goblin-1');
    await expect(args.onGrab).not.toHaveBeenCalled();

    // Their own moves.
    await userEvent.click(map.getByRole('button', { name: 'Enquadrar o mapa' }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const kaelen = playerTokens().find((token) => token.id === 'kaelen')!;
    await dragOnMap(frame, kaelen, { x: kaelen.x, y: kaelen.y + PRINTED_CELL * 2 });
    await expect(args.onDrop).toHaveBeenCalledWith('kaelen', kaelen.x, kaelen.y + PRINTED_CELL * 2);
  },
};

export const DuzentosTokens: Story = {
  name: '200 tokens',
  args: { ...tokenArgs, tokens: manyTokens(), viewerId: MASTER_ID, grid: defaultSceneGrid },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/200 tokens no mapa\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/** Mira walks a loop, as the socket would report another player's drag. */
function RemoteDrag(props: MapCanvasProps) {
  const [motion] = useState(createMotionStore);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const angle = ((now - start) / 2000) * Math.PI * 2;
      motion.push({ tokenId: 'mira', x: 1134 + Math.cos(angle) * 150, y: 354 + Math.sin(angle) * 90, ts: now }, now);
    }, 33);
    return () => clearInterval(timer);
  }, [motion]);
  return <TokenMap {...props} master={false} motion={motion} />;
}

export const MovidoPorOutro: Story = {
  name: 'Token movido por outro jogador',
  args: { ...tokenArgs, tokens: playerTokens(), viewerId: PLAYER_ID },
  render: (args) => <RemoteDrag {...args} />,
};
