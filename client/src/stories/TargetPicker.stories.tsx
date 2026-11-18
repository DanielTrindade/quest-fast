import { useState } from 'react';
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
    value: [],
    onChange: fn(),
  },
  // The list is controlled: the frame keeps the ticks so a story can tick several.
  render: function Controlled(args) {
    const [value, setValue] = useState(args.value);
    return (
      <TargetPicker {...args} value={value} onChange={(ids) => {
        setValue(ids);
        args.onChange(ids);
      }} />
    );
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof TargetPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The master reads every number, the hidden bandit included, and ticks an area's targets. */
export const Mestre: Story = {
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(within(region!).getByRole('group', { name: 'Alvos de Hazin Dan' }));
    await expect(list.getByRole('checkbox', { name: 'Goblin 2 — 3/7 PV' })).toBeInTheDocument();
    await expect(list.getByRole('checkbox', { name: 'Goblin 3 — Derrotado' })).toBeInTheDocument();
    await userEvent.click(list.getByRole('checkbox', { name: 'Goblin 2 — 3/7 PV' }));
    await expect(args.onChange).toHaveBeenLastCalledWith(['g2']);
    await userEvent.click(list.getByRole('checkbox', { name: /^Goblin 1/ }));
    await expect(args.onChange).toHaveBeenLastCalledWith(['g2', 'g1']);
    await expect(list.getByText('2 alvos: só uma salvaguarda em área usa mais de um.')).toBeVisible();
    await userEvent.click(list.getByRole('checkbox', { name: 'Goblin 2 — 3/7 PV' }));
    await expect(args.onChange).toHaveBeenLastCalledWith(['g1']);
  },
};

/** A player reads monsters by their band, and allies by their numbers. */
export const Jogador: Story = {
  args: { targets: playerCombatants.filter((combatant) => combatant.id !== 'c-hazin') },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await expect(list.getByRole('checkbox', { name: 'Goblin 2 — Muito ferido' })).toBeInTheDocument();
    await expect(list.getByRole('checkbox', { name: 'Lyra Ventoclaro — 27/27 PV' })).toBeInTheDocument();
    await expect(list.queryByRole('checkbox', { name: /Bandido/ })).toBeNull();
  },
};

export const SemAlvos: Story = { name: 'Sem alvos', args: { targets: [] } };
