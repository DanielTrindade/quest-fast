import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { HpAdjuster } from '../components/HpAdjuster';

const meta = {
  title: 'Componentes/HpAdjuster',
  component: HpAdjuster,
  args: { name: 'Goblin 2', onApply: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 520 }}><Story /></div>],
} satisfies Meta<typeof HpAdjuster>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const adjuster = within(region!);
    await expect(adjuster.getByRole('button', { name: 'Dano em Goblin 2' })).toBeDisabled();
    await userEvent.type(adjuster.getByLabelText('Quantidade'), '7');
    await userEvent.click(adjuster.getByRole('button', { name: 'Dano em Goblin 2' }));
    await expect(args.onApply).toHaveBeenCalledWith('damage', 7);
    // The amount clears, so a second click never repeats a hit by accident.
    await expect(adjuster.getByLabelText('Quantidade')).toHaveValue(null);
  },
};

/** At maximum, healing would change nothing; the server would refuse it. */
export const PvCheios: Story = {
  name: 'PV cheios',
  args: { full: true },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const adjuster = within(region!);
    await userEvent.type(adjuster.getByLabelText('Quantidade'), '3');
    await expect(adjuster.getByRole('button', { name: 'Cura em Goblin 2' })).toBeDisabled();
    await expect(adjuster.getByRole('button', { name: 'Temporários para Goblin 2' })).toBeEnabled();
  },
};

export const ForaDoLimite: Story = {
  name: 'Fora do limite',
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const adjuster = within(region!);
    await userEvent.type(adjuster.getByLabelText('Quantidade'), '1000');
    await expect(adjuster.getByRole('button', { name: 'Dano em Goblin 2' })).toBeDisabled();
  },
};

export const Enviando: Story = { args: { pending: true } };
