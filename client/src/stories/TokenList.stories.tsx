import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TokenList, type TokenListProps } from '../components/TokenList';
import { MASTER_ID, PLAYER_ID, manyTokens, masterTokens, playerTokens } from './fixtures/tokens';

/** Selection kept in the story, as the screen keeps it. */
function Selectable(props: TokenListProps) {
  const [selected, setSelected] = useState(props.selectedId);
  return <TokenList {...props} selectedId={selected} onSelect={(id) => {
    setSelected(id);
    props.onSelect(id);
  }} />;
}

const meta = {
  title: 'Componentes/TokenList',
  component: TokenList,
  args: {
    tokens: masterTokens(),
    viewerId: MASTER_ID,
    master: true,
    selectedId: null,
    onSelect: fn(),
    onStep: fn(),
    onToggleHidden: fn(),
    onRemove: fn(),
  },
  render: (args) => <Selectable {...args} />,
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof TokenList>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Mestre: Story = {
  play: async ({ canvasElement, args }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getByText('Escondido')).toBeVisible();
    await expect(list.getByText('Bia Souza está movendo')).toBeVisible();

    // Selecting a token and stepping it with the arrows.
    const ogre = list.getByRole('button', { name: /^Ogro/ });
    await userEvent.click(ogre);
    await expect(ogre).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onSelect).toHaveBeenCalledWith('ogre');
    await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    await expect(args.onStep).toHaveBeenNthCalledWith(1, 'ogre', { x: 1, y: 0 });
    await expect(args.onStep).toHaveBeenNthCalledWith(2, 'ogre', { x: 0, y: -1 });

    await userEvent.click(list.getByRole('button', { name: 'Revelar Bandido' }));
    await expect(args.onToggleHidden).toHaveBeenCalledWith('bandit', false);

    // Removing takes two steps.
    await userEvent.click(list.getByRole('button', { name: 'Remover Barril de pólvora do mapa' }));
    await expect(args.onRemove).not.toHaveBeenCalled();
    await userEvent.click(list.getByRole('button', { name: 'Remover Barril de pólvora' }));
    await expect(args.onRemove).toHaveBeenCalledWith('barrel');
  },
};

export const Jogador: Story = {
  args: { tokens: playerTokens(), viewerId: PLAYER_ID, master: false, onToggleHidden: undefined, onRemove: undefined },
  play: async ({ canvasElement, args }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getByText('Seu personagem')).toBeVisible();
    await expect(list.queryByRole('button', { name: /^Esconder/ })).toBeNull();

    // The arrows move only their own token.
    await userEvent.click(list.getByRole('button', { name: /^Goblin 1/ }));
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onStep).not.toHaveBeenCalled();
    await userEvent.click(list.getByRole('button', { name: /^Kaelen/ }));
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onStep).toHaveBeenCalledWith('kaelen', { x: 0, y: 1 });
  },
};

export const Ocupado: Story = {
  name: 'Pedido em andamento',
  args: { busyIds: new Set(['ogre']), selectedId: 'ogre' },
};

export const VaziaMestre: Story = {
  name: 'Vazia (mestre)',
  args: { tokens: [] },
};

export const VaziaJogador: Story = {
  name: 'Vazia (jogador)',
  args: { tokens: [], viewerId: PLAYER_ID, master: false },
};

export const DuzentosTokens: Story = {
  name: '200 tokens',
  args: { tokens: manyTokens() },
};
