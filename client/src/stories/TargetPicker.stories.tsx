import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TargetPicker } from '../components/TargetPicker';
import { masterCombatants, playerCombatants } from './fixtures/encounters';

const meta = {
  title: 'Componentes/TargetPicker',
  component: TargetPicker,
  args: {
    name: 'Hazin Dan',
    targets: masterCombatants.filter((combatant) => combatant.id !== 'c-hazin'),
    value: '',
    onChange: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof TargetPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The master reads every number, the hidden bandit included. */
export const Mestre: Story = {
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const select = within(region!).getByLabelText('Alvo de Hazin Dan');
    await expect(within(select).getByRole('option', { name: 'Goblin 2 — 3/7 PV' })).toBeInTheDocument();
    await expect(within(select).getByRole('option', { name: 'Goblin 3 — Derrotado' })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'g2');
    await expect(args.onChange).toHaveBeenCalledWith('g2');
  },
};

/** A player reads monsters by their band, and allies by their numbers. */
export const Jogador: Story = {
  args: { targets: playerCombatants.filter((combatant) => combatant.id !== 'c-hazin') },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const select = within(region!).getByLabelText('Alvo de Hazin Dan');
    await expect(within(select).getByRole('option', { name: 'Goblin 2 — Muito ferido' })).toBeInTheDocument();
    await expect(within(select).getByRole('option', { name: 'Lyra Ventoclaro — 27/27 PV' })).toBeInTheDocument();
    await expect(within(select).queryByRole('option', { name: /Bandido/ })).toBeNull();
  },
};

export const SemAlvos: Story = { name: 'Sem alvos', args: { targets: [] } };
