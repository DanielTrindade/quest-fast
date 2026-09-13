import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiceResult } from '../components/DiceResult';
const meta = { title: 'Componentes/DiceResult', component: DiceResult,
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
  args: { total: 23, decomposition: '16 + 7', dice: [{ value: 16, sides: 20 }], label: 'Ataque com espada longa' },
} satisfies Meta<typeof DiceResult>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Historico: Story = { name: 'Histórico compacto', args: { compact: true } };
export const HistoricoComDesvantagem: Story = { name: 'Histórico com desvantagem', args: {
  compact: true, total: -2, decomposition: '1 − 3', natural: 1, mode: 'disadvantage',
  label: 'Elara Sombravil, guardiã dos caminhos esquecidos: teste de Força',
  dice: [{ value: 12, sides: 20, discarded: true }, { value: 1, sides: 20 }],
} };
export const Vantagem: Story = { args: { mode: 'advantage', dice: [{ value: 16, sides: 20 }, { value: 9, sides: 20, discarded: true }] } };
export const Desvantagem: Story = { args: { total: 16, decomposition: '9 + 7', mode: 'disadvantage', dice: [{ value: 16, sides: 20, discarded: true }, { value: 9, sides: 20 }] } };
export const Natural20: Story = { name: '20 natural', args: { total: 27, decomposition: '20 + 7', natural: 20, dice: [{ value: 20, sides: 20 }] } };
export const Natural1: Story = { name: '1 natural', args: { total: 8, decomposition: '1 + 7', natural: 1, dice: [{ value: 1, sides: 20 }] } };
export const MultiplosDados: Story = { name: 'Múltiplos dados', args: { total: 12, decomposition: '3 + 6 + 3', label: 'Dano da espada', dice: [{ value: 3, sides: 6 }, { value: 6, sides: 6 }] } };
