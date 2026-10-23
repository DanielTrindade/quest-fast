import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { AttackCard } from '../components/AttackCard';

const dagger = { name: 'Adaga', bonus: 7, damage: '1d4+4', onRoll: fn() };

const meta = { title: 'Componentes/AttackCard', component: AttackCard, args: dagger } satisfies Meta<typeof AttackCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { args: dagger };
export const ComTipoENotas: Story = {
  name: 'Com tipo de dano e notas',
  args: { ...dagger, name: 'Machado Grande Hetto', bonus: 7, damage: '1d12+5', damageType: 'Cortante', notes: 'Pesada, duas mãos' },
};
export const Consulta: Story = { args: { ...dagger, onRoll: undefined } };
export const Rolando: Story = { args: { ...dagger, disabled: true } };
export const NomeLongo: Story = { args: { ...dagger, name: 'Espada curta élfica dos caminhos esquecidos', bonus: -1, damage: '1d4+4 mais 2d6 de veneno' } };
export const Resistencia: Story = {
  name: 'Resistência (CD)',
  // The target rolls a save: the card shows the DC and offers no attack roll.
  args: {
    kind: 'save', name: 'Palavra Radiante', dc: 13, saveAbility: 'constitution', damage: '1d6', damageType: 'Radiante', onRoll: fn(),
  },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await expect(within(region).getByText('Constituição — CD 13')).toBeVisible();
      await expect(within(region).queryByRole('button', { name: /Rolar ataque/ })).toBeNull();
    }
  },
};
