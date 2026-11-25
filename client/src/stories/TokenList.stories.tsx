import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TokenList, type TokenListProps } from '../components/TokenList';
import { fogOn } from './fixtures/fog';
import { MASTER_ID, PLAYER_ID, cell, fightMarksFor, fightTokens, manyTokens, masterTokens, playerTokens, vitalityTokens } from './fixtures/tokens';

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

    // A creature's token says it leaves the encounter too.
    await userEvent.click(list.getByRole('button', { name: 'Remover Goblin 1 do mapa' }));
    await expect(list.getByRole('group', { name: 'Remover Goblin 1 do mapa?' }))
      .toHaveAccessibleDescription('Também sai do encontro, se ele não terminou e ela não tem token em outra cena.');
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

export const CaidoEDerrotado: Story = {
  name: 'Caído e derrotado',
  args: { tokens: vitalityTokens() },
  play: async ({ canvasElement }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getByText('Caído')).toBeVisible();
    await expect(list.getByText('Derrotado')).toBeVisible();
  },
};

/** In a fight: whose turn it is, and each combatant's health in words, as the map rings it. */
export const EmCombate: Story = {
  name: 'Em combate',
  args: { tokens: fightTokens(), fightMarks: fightMarksFor(fightTokens()) },
  play: async ({ canvasElement }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getByText('Vez atual')).toBeVisible();
    await expect(list.getAllByText('Muito ferido')).toHaveLength(2);
    await expect(list.getByText('Ferido')).toBeVisible();
  },
};

/**
 * The master's list under the fog: the goblins, the ogre and the bandit
 * beyond the hall are "Na área oculta", the ambush in the hall is hidden in
 * the encounter, and the characters show wherever they stand.
 */
export const ComFog: Story = {
  name: 'Com fog (mestre)',
  args: {
    tokens: [...masterTokens(), { ...masterTokens().find((token) => token.id === 'goblin-1')!, id: 'ambush', name: 'Emboscada', combatantHidden: true, ...cell(16, 3) }],
    fog: fogOn,
  },
  play: async ({ canvasElement }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getAllByText('Na área oculta')).toHaveLength(4);
    await expect(list.getByText('Escondido no encontro')).toBeInTheDocument();
  },
};

/** A player's list never says what the fog hides: they only get what they may see. */
export const ComFogJogador: Story = {
  name: 'Com fog (jogador)',
  args: { tokens: playerTokens(), viewerId: PLAYER_ID, master: false, fog: fogOn },
  play: async ({ canvasElement }) => {
    await expect(firstTheme(canvasElement).queryByText('Na área oculta')).not.toBeInTheDocument();
  },
};
