import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AttackCard } from '../components/AttackCard';

const meta = { title: 'Componentes/AttackCard', component: AttackCard,
  args: { name: 'Adaga', bonus: 7, damage: '1d4+4', onRoll: fn() },
} satisfies Meta<typeof AttackCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = {};
export const ComTipoENotas: Story = {
  name: 'Com tipo de dano e notas',
  args: { name: 'Machado Grande Hetto', bonus: 7, damage: '1d12+5', damageType: 'Cortante', notes: 'Pesada, duas mãos' },
};
export const Consulta: Story = { args: { onRoll: undefined } };
export const Rolando: Story = { args: { disabled: true } };
export const NomeLongo: Story = { args: { name: 'Espada curta élfica dos caminhos esquecidos', bonus: -1, damage: '1d4+4 mais 2d6 de veneno' } };
