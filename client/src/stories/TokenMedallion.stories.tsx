import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { initials, type TokenView } from '@quest-fast/shared';
import { MapCanvas, type MapCanvasHandle } from '../components/MapCanvas';
import { drawTokens } from '../lib/token-draw';
import { canMoveToken } from '../lib/token-labels';
import { alignedSceneGrid, PRINTED_CELL, SYNTHETIC_MAP, syntheticMapUrl } from './fixtures/maps';
import { MASTER_ID, masterTokens, syntheticAvatarUrl } from './fixtures/tokens';

type Piece = { label: string; token: TokenView; selected?: boolean; lifted?: boolean };

function piece(id: string, name: string, fields: Partial<TokenView> & Pick<TokenView, 'kind'>): TokenView {
  return {
    id, name, size: 'medium', avatarUrl: null, vitality: 'up', initials: initials(name), x: 0, y: 0,
    characterId: null, combatantId: null, encounterId: null, statblockId: null, ownerId: null, hidden: false, movingBy: null, reach: null,
    ...fields,
  };
}

function pieces(): Piece[] {
  return [
    { label: 'Personagem com retrato', token: piece('a', 'Kaelen', { kind: 'character', avatarUrl: syntheticAvatarUrl() }) },
    { label: 'Personagem sem retrato', token: piece('b', 'Mira Folhaverde', { kind: 'character' }) },
    { label: 'Combatente', token: piece('c', 'Goblin 1', { kind: 'combatant' }) },
    { label: 'Token livre', token: piece('d', 'Barril de pólvora', { kind: 'free' }) },
    { label: 'Selecionado', token: piece('e', 'Ogro', { kind: 'combatant' }), selected: true },
    { label: 'Escondido (só o mestre)', token: piece('f', 'Bandido', { kind: 'combatant', hidden: true }) },
    { label: 'Caído', token: piece('g', 'Mira Folhaverde', { kind: 'character', vitality: 'down' }) },
    { label: 'Derrotado', token: piece('h', 'Goblin 2', { kind: 'combatant', vitality: 'defeated', avatarUrl: syntheticAvatarUrl() }) },
    { label: 'No ar, sendo arrastado', token: piece('i', 'Kaelen', { kind: 'character', avatarUrl: syntheticAvatarUrl() }), lifted: true },
  ];
}

/** One piece drawn alone, by the same code as the map, in the theme around it. */
function PieceTile({ entry, radius }: { entry: Piece; radius: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const side = Math.ceil(radius * 2 + 20);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = side * ratio;
    canvas.height = side * ratio;
    const images = new Map<string, HTMLImageElement>();
    const paint = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, side, side);
      drawTokens(context, {
        tokens: [{ ...entry.token, at: { x: 0, y: 0 }, lift: entry.lifted ? 1 : 0, ghost: null }],
        view: { x: side / 2, y: side / 2, scale: 1 },
        cellSize: radius * 2,
        selectedId: entry.selected ? entry.token.id : null,
        viewerId: null,
        images,
        themed: canvas,
      });
    };
    paint();
    const url = entry.token.avatarUrl;
    if (!url) return;
    const image = new Image();
    image.onload = () => {
      images.set(url, image);
      paint();
    };
    image.src = url;
  }, [entry, radius, side]);

  return (
    <figure className="m-0 flex w-28 flex-col items-center gap-2 text-center">
      <canvas ref={ref} aria-hidden="true" style={{ width: side, height: side }} />
      <figcaption className="text-small text-text-secondary">{entry.label}</figcaption>
    </figure>
  );
}

function PieceSheet({ radius }: { radius: number }) {
  const [entries] = useState(pieces);
  return (
    <div className="flex flex-wrap gap-4 rounded-panel border border-border bg-surface-secret p-4">
      {entries.map((entry) => <PieceTile key={entry.token.id} entry={entry} radius={radius} />)}
    </div>
  );
}

const meta = {
  title: 'Componentes/TokenMedallion',
  component: PieceSheet,
  args: { radius: 28 },
} satisfies Meta<typeof PieceSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

/** At table size every detail fits: band, pearls or rivets, the gem of a character up. */
export const Pecas: Story = { name: 'Peças' };

/** Zoomed out the band and the studs go first; the silhouette always stays. */
export const Pequenas: Story = { args: { radius: 16 } };
export const Minimas: Story = { name: 'Mínimas', args: { radius: 10 } };

/**
 * Drag a piece: it is saved where it lands, as the server would. A move past
 * 6 cells is refused and the piece goes back.
 */
function DragTable() {
  const [tokens, setTokens] = useState(masterTokens);
  const [selected, setSelected] = useState<string | null>(null);
  const map = useRef<MapCanvasHandle>(null);
  return (
    <MapCanvas ref={map} imageUrl={syntheticMapUrl()} mapWidth={SYNTHETIC_MAP.width} mapHeight={SYNTHETIC_MAP.height}
      grid={alignedSceneGrid} label="Salão em ruínas" tokens={tokens} viewerId={MASTER_ID} selectedTokenId={selected}
      onSelect={setSelected} canMove={(token) => canMoveToken(token, MASTER_ID, true)}
      onDrop={(id, x, y) => {
        const from = tokens.find((token) => token.id === id);
        if (!from) return;
        const cells = Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) / PRINTED_CELL;
        window.setTimeout(() => {
          if (cells > 6) map.current?.cancelDrag(id);
          else setTokens((current) => current.map((token) => (token.id === id ? { ...token, x, y } : token)));
        }, 120);
      }} />
  );
}

export const ArrastarESoltar: Story = {
  name: 'Arrastar e soltar',
  render: () => <div className="h-[420px] min-w-0"><DragTable /></div>,
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const frame = within(region).getByRole('group', { name: 'Salão em ruínas' });
    await waitFor(() => expect(frame).toHaveAttribute('data-status', 'ready'));
  },
};
