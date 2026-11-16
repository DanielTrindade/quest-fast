import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { RollPayload } from '@quest-fast/shared';
import { LinkedRollResult } from '../components/LinkedRollResult';

const attack: RollPayload = {
  kind: 'roll',
  expression: '1d20+7',
  dice: [{ value: 14, sides: 20 }],
  modifier: 7,
  total: 21,
  mode: 'normal',
  rollKind: 'attack',
  attackName: 'Machado Grande',
  characterName: 'Hazin Dan',
};

/** Graxa from the sheet: nothing rolled, the DC the target has to beat. */
const grease: RollPayload = {
  kind: 'roll',
  expression: '',
  dice: [],
  modifier: 0,
  total: 0,
  mode: 'normal',
  rollKind: 'attack',
  attackName: 'Graxa',
  characterName: 'Lyra Ventoclaro',
  save: { dc: 13, ability: 'dexterity' },
};

const meta = {
  title: 'Componentes/LinkedRollResult',
  component: LinkedRollResult,
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
  args: { payload: attack, name: 'Hazin Dan' },
} satisfies Meta<typeof LinkedRollResult>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ataque: Story = {};
export const SalvaguardaSemDano: Story = {
  name: 'Salvaguarda sem dano',
  args: { payload: grease, name: 'Lyra Ventoclaro' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const card = within(region!);
    await expect(card.getByText('CD 13')).toBeVisible();
    await expect(card.getByText('Salvaguarda de Destreza')).toBeVisible();
  },
};
