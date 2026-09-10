import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, expect, userEvent, within } from 'storybook/test';
import { AbilityCard } from '../components/AbilityCard';

const meta = {
  title: 'Componentes/AbilityCard', component: AbilityCard,
  args: { label: 'Destreza', abbreviation: 'DES', score: 18, modifier: 4, saveBonus: 6, proficient: true },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
} satisfies Meta<typeof AbilityCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Consulta: Story = {};
export const Interativo: Story = {
  args: { onCheck: fn(), onSave: fn() },
  play: async ({ canvasElement, args }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('button', { name: 'Teste de Destreza' }));
      await userEvent.click(within(region).getByRole('button', { name: 'Resistência de Destreza' }));
    }
    await expect(args.onCheck).toHaveBeenCalled();
    await expect(args.onSave).toHaveBeenCalled();
  },
};
export const Negativo: Story = { args: { label: 'Sabedoria', abbreviation: 'SAB', score: 8, modifier: -1, saveBonus: -1, proficient: false } };
export const Indisponivel: Story = { name: 'Indisponível', args: { onCheck: fn(), onSave: fn(), disabled: true } };
