import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { CombatEffectView } from '@quest-fast/shared';
import { EffectChips } from '../components/EffectChips';

const shieldOfFaith: CombatEffectView = {
  id: 'e1', name: 'Escudo da Fé', modifiers: { ac: { mode: 'add', value: 2 } }, duration: 'rounds', roundsLeft: 9,
  sourceCombatantId: 'cleric', concentration: true,
};
const aid: CombatEffectView = { id: 'e2', name: 'Auxílio', modifiers: { hpMax: 5 }, duration: 'none', concentration: false };
const slow: CombatEffectView = { id: 'e3', name: 'Lentidão', modifiers: { speed: { mode: 'half' }, ac: { mode: 'add', value: -2 } }, duration: 'encounter', concentration: false };
const shield: CombatEffectView = { id: 'e4', name: 'Escudo', modifiers: { ac: { mode: 'add', value: 5 } }, duration: 'untilTurnStart', concentration: false };

const meta = {
  title: 'Componentes/EffectChips',
  component: EffectChips,
  args: { name: 'Hazin Dan', effects: [shieldOfFaith, aid, slow, shield], onRemove: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof EffectChips>;
export default meta;
type Story = StoryObj<typeof meta>;

function chipsIn(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

export const ComEfeitos: Story = {
  name: 'Com efeitos',
  play: async ({ canvasElement, args }) => {
    const chips = chipsIn(canvasElement);
    await expect(chips.getByText('Escudo da Fé: CA +2, 9 rodadas, concentração')).toBeInTheDocument();
    await userEvent.click(chips.getByRole('button', { name: 'Remover Auxílio de Hazin Dan' }));
    await expect(args.onRemove).toHaveBeenCalledWith('e2');
  },
};

/** Only the effects this viewer may take off get the button: here, the one their character cast. */
export const RemoveSoOsSeus: Story = {
  name: 'Remove só os seus',
  args: { canRemove: (effect) => 'sourceCombatantId' in effect && effect.sourceCombatantId === 'cleric' },
  play: async ({ canvasElement }) => {
    const chips = chipsIn(canvasElement);
    await expect(chips.getAllByRole('button')).toHaveLength(1);
    await expect(chips.getByRole('button', { name: 'Remover Escudo da Fé de Hazin Dan' })).toBeInTheDocument();
  },
};

/** A monster's effects, as a player gets them: the name, never the numbers. */
export const MonstroParaJogador: Story = {
  name: 'Monstro, para o jogador',
  args: { name: 'Goblin 2', effects: [{ id: 'm1', name: 'Pele de Pedra' }, { id: 'm2', name: 'Velocidade' }], onRemove: undefined },
  play: async ({ canvasElement }) => {
    await expect(chipsIn(canvasElement).queryByRole('button')).toBeNull();
  },
};

/** Long names and many modifiers: the chips wrap, never overflow. */
export const NomesLongos: Story = {
  name: 'Nomes longos',
  args: {
    effects: [
      {
        id: 'l1', name: 'Proteção contra Energia (concedida pelo amuleto)', modifiers: { resistances: ['fire', 'cold', 'lightning', 'thunder', 'acid'] },
        duration: 'rounds', roundsLeft: 100, sourceCombatantId: 'x', concentration: true,
      },
      {
        id: 'l2', name: 'Pele de Pedra',
        modifiers: { resistances: ['bludgeoning', 'piercing', 'slashing'], speed: { mode: 'add', value: -1.5 }, hpMax: 12, ac: { mode: 'set', value: 17 } },
        duration: 'none', concentration: false,
      },
    ],
  },
};
