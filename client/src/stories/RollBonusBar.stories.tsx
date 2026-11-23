import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { RollBonusBar } from '../components/RollBonusBar';
import { NO_ROLL_BONUS, type RollBonusDraft } from '../lib/roll-bonus-draft';

function Example({ initial = NO_ROLL_BONUS }: { initial?: RollBonusDraft }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ maxWidth: 360 }}>
      <RollBonusBar value={value} onChange={setValue} />
    </div>
  );
}

const meta = { title: 'Componentes/RollBonusBar', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Vazio: Story = {};

/** Bênção on the d20, Marca do Caçador on the damage: the bar says it is on. */
export const Ativo: Story = { args: { initial: { roll: '+1d4', damage: '+1d6' } } };

/** Perdição takes a die away. */
export const DadoNegativo: Story = { name: 'Dado negativo', args: { initial: { roll: '-1d4', damage: '' } } };

export const Invalido: Story = {
  name: 'Inválido',
  args: { initial: { roll: 'bênção', damage: '+1d' } },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getAllByText('Use dado e número com sinal, como +1d4, -1d4 ou +2.')).toHaveLength(2);
  },
};

export const Interativo: Story = {
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const bar = within(region!);
    await expect(bar.queryByText('Ativo')).toBeNull();
    await userEvent.type(bar.getByLabelText('No d20'), '+1d4');
    await expect(bar.getByText('Ativo')).toBeVisible();
    await userEvent.click(bar.getByRole('button', { name: 'Limpar os modificadores' }));
    await expect(bar.getByLabelText('No d20')).toHaveValue('');
    await expect(bar.queryByText('Ativo')).toBeNull();
  },
};
