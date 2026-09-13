import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { ProficiencyLevel } from '@quest-fast/shared';
import { ProficiencyToggle } from '../components/ProficiencyToggle';

function Example({ initial = 'none' }: { initial?: ProficiencyLevel }) {
  const [value, setValue] = useState<ProficiencyLevel>(initial);
  const bonus = { none: '+2', proficient: '+4', expert: '+6' }[value];
  return (
    <div style={{ maxWidth: 280 }}>
      <ProficiencyToggle label="Furtividade" detail={bonus} value={value} onChange={setValue} />
    </div>
  );
}

const meta = { title: 'Componentes/ProficiencyToggle', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Nenhuma: Story = {};
export const Proficiente: Story = { args: { initial: 'proficient' } };
export const Especialista: Story = { args: { initial: 'expert' } };

export const Interativo: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('radio', { name: 'Especialista' }));
      await expect(within(region).getByRole('radio', { name: 'Especialista' })).toBeChecked();
      await expect(within(region).getByText('+6')).toBeVisible();
    }
  },
};
