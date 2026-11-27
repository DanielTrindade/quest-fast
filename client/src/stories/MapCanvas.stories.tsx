import { StrictMode, useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within, type Mock } from 'storybook/test';
import type { TokenView } from '@quest-fast/shared';
import { MapCanvas, type MapCanvasProps } from '../components/MapCanvas';
import { Button } from '../components/ui/button';
import { createAreaPreviewStore } from '../lib/area-preview';
import { fitView } from '../lib/map-view';
import { canMoveToken } from '../lib/token-labels';
import { createMotionStore } from '../lib/token-motion';
import { corner, sceneAreas } from './fixtures/areas';
import { fogOn, fogStart } from './fixtures/fog';
import { PRINTED_CELL, PRINTED_OFFSET, SYNTHETIC_MAP, alignedSceneGrid, defaultSceneGrid, syntheticMapUrl } from './fixtures/maps';
import { MASTER_ID, PLAYER_ID, cell, fightMarksFor, fightTokens, manyTokens, masterTokens, playerFightTokens, playerTokens, vitalityTokens } from './fixtures/tokens';

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

/**
 * A scene opens zoomed in, about 15 cells across; the checks that aim at map
 * points frame the whole map first, where `onPage` expects it.
 */
async function framedMap(canvasElement: HTMLElement) {
  const ready = await readyMap(canvasElement);
  await frameWhole(ready.frame, ready.map);
  return ready;
}

/**
 * Frames the whole map and waits for the glide to end: the zoom shown is
 * the framed one. A fixed wait raced the glide on a busy machine, and a
 * drag aimed with `onPage` then landed off the token.
 */
async function frameWhole(frame: HTMLElement, map: ReturnType<typeof within>) {
  await userEvent.click(map.getByRole('button', { name: 'Enquadrar o mapa' }));
  const rect = frame.querySelector('canvas')!.getBoundingClientRect();
  const framed = Math.round(fitView(SYNTHETIC_MAP, { width: rect.width, height: rect.height }).scale * 100);
  await waitFor(() => expect(map.getByText(/\d+%$/).textContent).toMatch(new RegExp(`(^|\\D)${framed}%$`)));
}

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    const zoom = () => map.getByText(/\d+%$/).textContent;
    const opened = await waitFor(zoom);
    // It opens closer than the whole map: about 15 cells across.
    await userEvent.click(map.getByRole('button', { name: 'Enquadrar o mapa' }));
    await waitFor(() => expect(zoom()).not.toBe(opened));
    const framed = zoom();

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

/** The switch only: the screen decides what full screen means (the Mesa fills the window). */
function FullscreenSwitch(props: MapCanvasProps) {
  const { onFullscreenChange } = props;
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <MapCanvas {...props} imageUrl={props.imageUrl || syntheticMapUrl()} fullscreen={fullscreen}
      onFullscreenChange={(next) => {
        setFullscreen(next);
        onFullscreenChange?.(next);
      }} />
  );
}

export const TelaCheia: Story = {
  name: 'Botão de tela cheia',
  args: { onFullscreenChange: fn() },
  render: (args) => <FullscreenSwitch {...args} />,
  play: async ({ canvasElement, args }) => {
    const { map } = await readyMap(canvasElement);
    await userEvent.click(map.getByRole('button', { name: 'Mapa em tela cheia' }));
    await expect(args.onFullscreenChange).toHaveBeenCalledWith(true);
    await userEvent.click(map.getByRole('button', { name: 'Sair da tela cheia' }));
    await expect(args.onFullscreenChange).toHaveBeenLastCalledWith(false);
  },
};

export const TelaCheiaComErro: Story = {
  name: 'Tela cheia com o mapa em erro',
  args: { imageUrl: '/mapa-que-nao-existe.jpg', fullscreen: true, onFullscreenChange: fn() },
  render: (args) => <MapCanvas {...args} />,
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const frame = within(region).getByRole('group', { name: 'Salão em ruínas' });
    await waitFor(() => expect(frame).toHaveAttribute('data-status', 'error'));
    await userEvent.click(within(frame).getByRole('button', { name: 'Sair da tela cheia' }));
    await expect(args.onFullscreenChange).toHaveBeenCalledWith(false);
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

/** A drag from `from` to `to` still held, and how to let go of it. */
async function holdDrag(frame: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  const canvas = frame.querySelector('canvas')!;
  const start = onPage(frame, from);
  const end = onPage(frame, to);
  // One instance for the press and the release: each direct call starts with no button down.
  const user = userEvent.setup();
  await user.pointer([
    { keys: '[MouseLeft>]', target: canvas, coords: start },
    ...[0.25, 0.5, 0.75, 1].map((t) => ({ coords: { clientX: start.clientX + (end.clientX - start.clientX) * t, clientY: start.clientY } })),
  ]);
  return () => user.pointer({ keys: '[/MouseLeft]', target: canvas, coords: end });
}

/** The whole element within the frame, none of it cut. */
async function expectInside(element: HTMLElement, frame: HTMLElement) {
  const inner = element.getBoundingClientRect();
  const outer = frame.getBoundingClientRect();
  await expect(inner.left).toBeGreaterThanOrEqual(outer.left);
  await expect(inner.right).toBeLessThanOrEqual(outer.right);
  await expect(inner.top).toBeGreaterThanOrEqual(outer.top);
  await expect(inner.bottom).toBeLessThanOrEqual(outer.bottom);
}

/** A press and release in place: selects a token, never pans the map. */
async function pressOnMap(frame: HTMLElement, point: { x: number; y: number }) {
  await userEvent.pointer([{ keys: '[MouseLeft]', target: frame.querySelector('canvas')!, coords: onPage(frame, point) }]);
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
    const { frame, map } = await framedMap(canvasElement);
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
    const { frame, map } = await framedMap(canvasElement);
    await expect(map.getByText(/6 tokens no mapa\./)).toBeInTheDocument();

    // Someone else's token only gets selected: the press pans the map.
    const goblin = playerTokens().find((token) => token.id === 'goblin-1')!;
    await dragOnMap(frame, goblin, { x: goblin.x + PRINTED_CELL * 2, y: goblin.y });
    await expect(args.onSelect).toHaveBeenCalledWith('goblin-1');
    await expect(args.onGrab).not.toHaveBeenCalled();

    // Their own moves.
    await frameWhole(frame, map);
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
    const { frame, map } = await framedMap(canvasElement);
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
  play: async ({ canvasElement }) => {
    const { frame } = await framedMap(canvasElement);
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/** Fed by the play, not by a timer: the press must find the token where it is drawn at that moment. */
const heldMotion = createMotionStore();

export const ToqueNoTokenEmMovimento: Story = {
  name: 'Toque no token que outro jogador move',
  args: { ...tokenArgs, tokens: playerTokens(), viewerId: PLAYER_ID },
  render: (args) => <TokenMap {...args} master={false} motion={heldMotion} />,
  play: async ({ canvasElement, args }) => {
    const { frame } = await framedMap(canvasElement);
    const mira = playerTokens().find((token) => token.id === 'mira')!;
    const away = { x: mira.x + PRINTED_CELL * 5, y: mira.y + PRINTED_CELL * 3 };
    // A drag goes quiet after a second; each press gets fresh samples.
    const report = () => {
      for (let index = 0; index < 4; index += 1) {
        const now = performance.now() - (3 - index) * 33;
        heldMotion.push({ tokenId: 'mira', ...away, ts: now }, now);
      }
    };

    // Where she is saved there is only map now.
    report();
    await pressOnMap(frame, mira);
    await expect(args.onSelect).not.toHaveBeenCalledWith('mira');
    // Where she is drawn, she is found.
    report();
    await pressOnMap(frame, away);
    await expect(args.onSelect).toHaveBeenCalledWith('mira');
  },
};

/** In a fight, the selected token shows the whole area it can still reach. */
export const AlcanceEmCombate: Story = {
  name: 'Alcance em combate',
  args: { ...tokenArgs, tokens: playerFightTokens(), viewerId: PLAYER_ID, selectedTokenId: 'kaelen' },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await framedMap(canvasElement);
    await expect(map.getByText(/Kaelen ainda alcança 4,5 m, 3 casas em qualquer direção\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/**
 * A player drags Kaelen five squares with 4.5 m left: while dragging, the
 * label beside him says how far past it goes; dropped, he stops on the third.
 */
export const ParaNoLimite: Story = {
  name: 'Para no limite (jogador)',
  args: { ...tokenArgs, tokens: playerFightTokens(), viewerId: PLAYER_ID, selectedTokenId: 'kaelen', stopAtLimit: () => true },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement, args }) => {
    const { frame } = await framedMap(canvasElement);
    await waitFor(() => expect(painted(frame)).toBe(true));
    const kaelen = cell(17, 4);
    const release = await holdDrag(frame, kaelen, cell(22, 4));
    const label = frame.querySelector<HTMLElement>('[data-slot="move-label"]')!;
    await waitFor(() => expect(label).toBeVisible());
    // The label follows the drag frame by frame: its last text, then its place
    // (which also follows its size, should the font arrive late) settle.
    await waitFor(() => expect(label).toHaveTextContent('2 casas além do deslocamento. Para em 3 casas, 4,5 m.'));
    await waitFor(() => expectInside(label, frame));
    await release();
    await expect(args.onDrop).toHaveBeenCalledWith('kaelen', kaelen.x + PRINTED_CELL * 3, kaelen.y);
    await waitFor(() => expect(label).not.toBeVisible());
  },
};

/**
 * The same drag where the move spends nothing (outside a fight, before the
 * first round): Kaelen rests where he is dropped, five squares away.
 */
export const LivreForaDoCombate: Story = {
  name: 'Livre fora do combate (jogador)',
  args: { ...tokenArgs, tokens: playerFightTokens(), viewerId: PLAYER_ID, selectedTokenId: 'kaelen', stopAtLimit: () => false },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement, args }) => {
    const { frame } = await framedMap(canvasElement);
    await waitFor(() => expect(painted(frame)).toBe(true));
    const kaelen = cell(17, 4);
    const release = await holdDrag(frame, kaelen, cell(22, 4));
    const label = frame.querySelector<HTMLElement>('[data-slot="move-label"]')!;
    await waitFor(() => expect(label).toHaveTextContent('2 casas além do deslocamento.'));
    await expectInside(label, frame);
    await release();
    await expect(args.onDrop).toHaveBeenCalledWith('kaelen', kaelen.x + PRINTED_CELL * 5, kaelen.y);
  },
};

const confirmArgs = { onConfirm: fn(), onCancel: fn(), onFree: fn() };

/** Dropped two squares away: the cost fits, and confirming spends it. */
export const MovimentoAConfirmar: Story = {
  name: 'Movimento a confirmar',
  args: {
    ...tokenArgs,
    tokens: playerFightTokens(),
    viewerId: PLAYER_ID,
    pendingMove: { tokenId: 'kaelen', ...cell(19, 4) },
    moveConfirm: { onConfirm: confirmArgs.onConfirm, onCancel: confirmArgs.onCancel },
  },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement }) => {
    const { map } = await readyMap(canvasElement);
    const bar = within(map.getByRole('group', { name: 'Confirmar movimento de Kaelen' }));
    await expect(bar.getByText(/2 casas, 3 m/)).toBeVisible();
    await expect(bar.queryByRole('button', { name: /Mover sem gastar/ })).toBeNull();
    await userEvent.click(bar.getByRole('button', { name: /Confirmar movimento/ }));
    await expect(confirmArgs.onConfirm).toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(confirmArgs.onCancel).toHaveBeenCalled();
  },
};

/** Five squares is past the 4.5 m left: it cannot be confirmed, but the master may move without spending. */
export const MovimentoAlemDoAlcance: Story = {
  name: 'Movimento além do alcance (mestre)',
  args: {
    ...tokenArgs,
    tokens: fightTokens(),
    viewerId: MASTER_ID,
    pendingMove: { tokenId: 'kaelen', ...cell(17, 9) },
    moveConfirm: confirmArgs,
  },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { map } = await readyMap(canvasElement);
    const bar = within(map.getByRole('group', { name: 'Confirmar movimento de Kaelen' }));
    await expect(bar.getByText(/Passa do que resta \(4,5 m\)/)).toBeVisible();
    await expect(bar.getByRole('button', { name: /Confirmar movimento/ })).toBeDisabled();
    await userEvent.click(bar.getByRole('button', { name: /Mover sem gastar/ }));
    await expect(confirmArgs.onFree).toHaveBeenCalled();
  },
};

/** Mira is down (danger ring, faded); Goblin 1 is defeated (grey, crossed out, under the rest). */
export const CaidoEDerrotado: Story = {
  name: 'Caído e derrotado',
  args: { ...tokenArgs, tokens: vitalityTokens(), viewerId: MASTER_ID },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/7 tokens no mapa\. 1 caído, 1 derrotado\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/**
 * Kaelen's turn: a ring and a notch above his piece. Every combatant has its
 * health arc, full for Kaelen and Goblin 2, emptying for the rest; the
 * barrel, outside the fight, has none. The ogre is selected: the ring runs
 * round its arc.
 */
export const VezESaude: Story = {
  name: 'Vez e saúde no combate',
  args: { ...tokenArgs, tokens: fightTokens(), viewerId: MASTER_ID, fightMarks: fightMarksFor(fightTokens()), selectedTokenId: 'ogre' },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/7 tokens no mapa\. Vez de Kaelen\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/**
 * Kaelen asked to see the range of his hand axe (6/18 m) on his turn: a firm
 * outline over the normal range, a lighter one at the long range, both
 * counted in squares like a move.
 */
export const AlcanceDoAtaque: Story = {
  name: 'Alcance do ataque',
  args: {
    ...tokenArgs, tokens: fightTokens(), viewerId: MASTER_ID, fightMarks: fightMarksFor(fightTokens()),
    attackRange: { tokenId: 'kaelen', normal: 6, long: 18 },
  },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/Alcance do ataque de Kaelen: 6 m e, com desvantagem, até 18 m\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/** Late in the fight, on the ogre's turn: the fallen and the defeated carry no arc. */
export const VezDoOgroComCaidos: Story = {
  name: 'Vez do ogro, com caídos',
  args: { ...tokenArgs, tokens: vitalityTokens(), viewerId: MASTER_ID, fightMarks: fightMarksFor(vitalityTokens(), 'ogre') },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await readyMap(canvasElement);
    await expect(map.getByText(/1 caído, 1 derrotado\. Vez de Ogro\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

// --- Fog of war -----------------------------------------------------------

/**
 * The colour of the canvas at a map point, as [r, g, b]: the fog drawn over
 * the map changes it. Read on the framed map, where `onPage` aims.
 */
function pixelAt(frame: HTMLElement, point: { x: number; y: number }): number[] {
  const canvas = frame.querySelector('canvas')!;
  const rect = canvas.getBoundingClientRect();
  const { clientX, clientY } = onPage(frame, point);
  const scale = canvas.width / rect.width;
  const data = canvas.getContext('2d')!.getImageData(Math.round((clientX - rect.left) * scale), Math.round((clientY - rect.top) * scale), 1, 1).data;
  return [data[0], data[1], data[2]];
}

const fogArgs = { ...tokenArgs, tokens: masterTokens(), viewerId: MASTER_ID, fog: fogOn };

/** The master sees through the fog; the goblins and the ogre beyond the hall show faded, as hidden tokens do. */
export const FogMestre: Story = {
  name: 'Fog (mestre)',
  args: fogArgs,
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await framedMap(canvasElement);
    await expect(map.getByText(/7 tokens no mapa\. Fog ligado: 3 áreas reveladas\./)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

/** A combatant hidden in the encounter, standing in the revealed hall: no player receives it. */
function ambush(): TokenView {
  return { ...masterTokens().find((token) => token.id === 'goblin-1')!, id: 'ambush', name: 'Emboscada', combatantHidden: true, ...cell(16, 3) };
}

/**
 * "Ver como jogador": opaque, and only what a player receives — the
 * characters and the barrel in the hall, not the ambush hidden in the
 * encounter even though it stands in the light.
 */
export const FogComoJogador: Story = {
  name: 'Fog (ver como jogador)',
  args: { ...fogArgs, tokens: [...masterTokens(), ambush()], fogLook: 'player' },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await framedMap(canvasElement);
    await expect(map.getByText(/3 tokens no mapa\. Fog ligado, como os jogadores veem: 3 áreas reveladas\./)).toBeInTheDocument();
    // The same hidden corner of the map in two spots: opaque fog is one flat colour.
    await waitFor(() => expect(pixelAt(frame, { x: 1700, y: 100 })).toEqual(pixelAt(frame, { x: 1650, y: 1100 })));
  },
};

/** A fresh scene with the fog just turned on: everything hidden, characters still on the map. */
export const FogTudoOculto: Story = {
  name: 'Fog (tudo oculto)',
  args: { ...fogArgs, tokens: playerTokens().filter((token) => token.kind === 'character'), viewerId: PLAYER_ID, fog: fogStart, fogLook: 'player' },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement }) => {
    const { map } = await framedMap(canvasElement);
    await expect(map.getByText(/Fog ligado, como os jogadores veem: nada revelado\./)).toBeInTheDocument();
  },
};

/** The rectangle grows to the printed grid around the cells it touched; the map does not pan. */
export const FogRetangulo: Story = {
  name: 'Fog: desenhar retângulo',
  args: { ...fogArgs, fogTool: { mode: 'reveal', shape: 'rect' }, onFogShape: fn() },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement, args }) => {
    const { frame, map } = await framedMap(canvasElement);
    await expect(map.getByText(/Arraste para desenhar o retângulo do fog/)).toBeInTheDocument();
    await dragOnMap(frame, cell(2, 2), cell(4, 3));
    await expect(args.onFogShape).toHaveBeenCalledWith({
      mode: 'reveal',
      shape: { kind: 'rect', x: PRINTED_OFFSET + 2 * PRINTED_CELL, y: PRINTED_OFFSET + 2 * PRINTED_CELL, width: 3 * PRINTED_CELL, height: 2 * PRINTED_CELL },
    });
    // The tool took the press: no token was grabbed, even over the party.
    const kaelen = masterTokens().find((token) => token.id === 'kaelen')!;
    await dragOnMap(frame, kaelen, { x: kaelen.x + PRINTED_CELL, y: kaelen.y });
    await expect(args.onGrab).not.toHaveBeenCalled();
  },
};

/** Point by point, closed on the first one; the bar counts them and finishes with "Concluir" too. */
export const FogPoligono: Story = {
  name: 'Fog: desenhar polígono',
  args: { ...fogArgs, fogTool: { mode: 'hide', shape: 'polygon' }, onFogShape: fn() },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement, args }) => {
    const { frame, map } = await framedMap(canvasElement);
    const corners = [cell(15, 3), cell(18, 3), cell(18, 6)];
    for (const corner of corners) await pressOnMap(frame, corner);
    const bar = within(map.getByRole('group', { name: 'Polígono do fog' }));
    await expect(bar.getByText('3')).toBeInTheDocument();
    await pressOnMap(frame, corners[0]!);
    await waitFor(() => expect(args.onFogShape).toHaveBeenCalledTimes(1));
    const [operation] = (args.onFogShape as ReturnType<typeof fn>).mock.calls[0]!;
    await expect(operation.mode).toBe('hide');
    await expect(operation.shape.points).toHaveLength(3);
    await expect(map.queryByRole('group', { name: 'Polígono do fog' })).not.toBeInTheDocument();

    // Two points, then Backspace takes one back and Esc drops the rest.
    await pressOnMap(frame, cell(10, 10));
    await pressOnMap(frame, cell(12, 10));
    frame.focus();
    await userEvent.keyboard('{Backspace}');
    await expect(within(map.getByRole('group', { name: 'Polígono do fog' })).getByText('1')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect(map.queryByRole('group', { name: 'Polígono do fog' })).not.toBeInTheDocument();
    await expect(args.onFogShape).toHaveBeenCalledTimes(1);

    // Enter on "Cancelar" is that button's: it drops the shape, never sends it.
    for (const corner of [cell(10, 10), cell(13, 10), cell(13, 13)]) await pressOnMap(frame, corner);
    within(map.getByRole('group', { name: 'Polígono do fog' })).getByRole('button', { name: 'Cancelar' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(map.queryByRole('group', { name: 'Polígono do fog' })).not.toBeInTheDocument();
    await expect(args.onFogShape).toHaveBeenCalledTimes(1);
  },
};

/** The master's tool switch, as the toolbar does it. */
function ToolSwitch(props: MapCanvasProps) {
  const [shape, setShape] = useState<'polygon' | 'rect'>('polygon');
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setShape('polygon')}>Polígono</Button>
        <Button variant="secondary" size="sm" onClick={() => setShape('rect')}>Retângulo</Button>
      </div>
      <TokenMap {...props} master fogTool={{ mode: 'reveal', shape }} />
    </div>
  );
}

/** Changing tools drops the polygon being drawn: coming back starts empty, with no bar left over. */
export const FogTrocaDeFerramenta: Story = {
  name: 'Fog: trocar de ferramenta no meio',
  args: { ...fogArgs, onFogShape: fn() },
  render: (args) => <ToolSwitch {...args} />,
  play: async ({ canvasElement, args }) => {
    const { frame, map } = await framedMap(canvasElement);
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const controls = within(region!);
    for (const corner of [cell(10, 10), cell(13, 10), cell(13, 13)]) await pressOnMap(frame, corner);
    await expect(within(map.getByRole('group', { name: 'Polígono do fog' })).getByText('3')).toBeInTheDocument();

    await userEvent.click(controls.getByRole('button', { name: 'Retângulo' }));
    await expect(map.queryByRole('group', { name: 'Polígono do fog' })).not.toBeInTheDocument();
    await userEvent.click(controls.getByRole('button', { name: 'Polígono' }));
    await expect(map.queryByRole('group', { name: 'Polígono do fog' })).not.toBeInTheDocument();

    // A new drawing starts from its first point.
    await pressOnMap(frame, cell(5, 5));
    await expect(within(map.getByRole('group', { name: 'Polígono do fog' })).getByText('1')).toBeInTheDocument();
    await expect(args.onFogShape).not.toHaveBeenCalled();
  },
};

// --- Areas (#113) ---------------------------------------------------------

const areaArgs = { ...tokenArgs, sceneId: 's-hall', areas: sceneAreas() };

export const AreasMestre: Story = {
  name: 'Áreas (mestre)',
  args: { ...areaArgs, tokens: masterTokens(), viewerId: MASTER_ID, master: true },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { frame, map } = await framedMap(canvasElement);
    await expect(map.getByText(/6 áreas no mapa: Teia \(Cubo de 6 m\)/)).toBeInTheDocument();
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};

export const AreasJogador: Story = {
  name: 'Áreas (jogador)',
  args: { ...areaArgs, areas: sceneAreas().filter((area) => !area.hidden), tokens: playerTokens(), viewerId: PLAYER_ID },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement }) => {
    const { map } = await framedMap(canvasElement);
    await expect(map.getByText(/5 áreas no mapa/)).toBeInTheDocument();
  },
};

export const AreasComoJogador: Story = {
  name: 'Áreas: ver como jogador',
  args: { ...areaArgs, tokens: masterTokens(), viewerId: MASTER_ID, master: true, fogLook: 'player' },
  render: (args) => <TokenMap {...args} master />,
  play: async ({ canvasElement }) => {
    const { map } = await framedMap(canvasElement);
    // The hidden glyph is not the table's.
    await expect(map.getByText(/5 áreas no mapa/)).toBeInTheDocument();
  },
};

export const AreaDesenhando: Story = {
  name: 'Área: desenhar uma referência',
  args: {
    ...areaArgs, areas: [], tokens: playerTokens(), viewerId: PLAYER_ID, onAreaPreview: fn(), onAreaPlace: fn(),
    areaTool: { mode: 'reference', shape: 'cone', size: 4.5, width: 1.5 },
  },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement, args }) => {
    const { frame } = await framedMap(canvasElement);
    const origin = corner(6, 6);
    await dragOnMap(frame, origin, { x: origin.x + PRINTED_CELL * 3, y: origin.y });
    // The table sees it while drawn, and once more when let go: pointing east from the corner.
    await expect(args.onAreaPreview).toHaveBeenCalled();
    await expect(args.onAreaPreview).toHaveBeenLastCalledWith(expect.objectContaining({ shape: 'cone', x: origin.x, y: origin.y, angle: 0 }), true);
    await expect(args.onAreaPlace).not.toHaveBeenCalled();
    // Nothing was grabbed: the tool took the press.
    await expect(args.onGrab).not.toHaveBeenCalled();
  },
};

export const AreaFicaNaCena: Story = {
  name: 'Área: pôr na cena',
  args: {
    ...areaArgs, areas: [], tokens: playerTokens(), viewerId: PLAYER_ID, onAreaPreview: fn(), onAreaPlace: fn(),
    areaTool: { mode: 'persistent', shape: 'sphere', size: 6, width: 1.5 },
  },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement, args }) => {
    const { frame } = await framedMap(canvasElement);
    const at = corner(8, 8);
    await dragOnMap(frame, corner(6, 6), { x: at.x + 9, y: at.y - 7 });
    // The centre follows the pointer and rests on the intersection; a persistent area is never previewed.
    await expect(args.onAreaPlace).toHaveBeenCalledWith(expect.objectContaining({ shape: 'sphere', size: 6, x: at.x, y: at.y }));
    await expect(args.onAreaPreview).not.toHaveBeenCalled();
  },
};

export const AreaParada: Story = {
  name: 'Área: referência parada sob o dedo',
  args: {
    ...areaArgs, areas: [], tokens: playerTokens(), viewerId: PLAYER_ID, onAreaPreview: fn(),
    areaTool: { mode: 'reference', shape: 'sphere', size: 6, width: 1.5 },
  },
  render: (args) => <TokenMap {...args} master={false} />,
  play: async ({ canvasElement, args }) => {
    const { frame } = await framedMap(canvasElement);
    const release = await holdDrag(frame, corner(6, 6), corner(9, 6));
    const sent = (args.onAreaPreview as Mock).mock.calls.length;
    // Held still past the time a watcher drops a silent preview: it keeps going out.
    await new Promise((resolve) => setTimeout(resolve, 1700));
    await expect((args.onAreaPreview as Mock).mock.calls.length).toBeGreaterThan(sent + 1);
    await release();
    await expect(args.onAreaPreview).toHaveBeenLastCalledWith(expect.objectContaining({ shape: 'sphere' }), true);
  },
};

/** Someone else's reference area arriving by the socket. */
function OthersPreview(props: MapCanvasProps) {
  const [previews] = useState(() => {
    const store = createAreaPreviewStore();
    store.push({
      type: 'area.previewing', sceneId: 's-hall', by: { userId: 'u-bia', name: 'Bia Souza' },
      area: { shape: 'sphere', size: 6, width: 1.5, ...corner(12, 9), angle: 0 }, done: true, ts: 0,
    }, performance.now());
    return store;
  });
  return <TokenMap {...props} master={false} areaPreviews={previews} />;
}

export const AreaDeOutraPessoa: Story = {
  name: 'Área: referência de outra pessoa',
  args: { ...areaArgs, areas: [], tokens: playerTokens(), viewerId: PLAYER_ID },
  render: (args) => <OthersPreview {...args} />,
  play: async ({ canvasElement }) => {
    const { frame } = await framedMap(canvasElement);
    await waitFor(() => expect(painted(frame)).toBe(true));
  },
};
