import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { QuickDice } from '../components/QuickDice';

function Example({ lastExpression = null, disabled = false }: { lastExpression?: string | null; disabled?: boolean }) {
  const [expression, setExpression] = useState('');
  return (
    <div className="qf-stack" style={{ maxWidth: 340 }}>
      <QuickDice onPick={setExpression} lastExpression={lastExpression} disabled={disabled} />
      <p aria-live="polite" className="text-small text-text-secondary">
        Expressão: {expression || '—'}
      </p>
    </div>
  );
}

const meta = { title: 'Componentes/QuickDice', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SemUltimaRolagem: Story = {};
export const ComUltimaRolagem: Story = { args: { lastExpression: '2d6+3' } };
export const Desabilitado: Story = { args: { disabled: true, lastExpression: '1d20+5' } };

export const Interativo: Story = {
  args: { lastExpression: '1d20+5' },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('button', { name: 'Usar 1d20' }));
      await expect(within(region).getByText('Expressão: 1d20')).toBeVisible();
      await userEvent.click(within(region).getByRole('button', { name: 'Repetir 1d20+5' }));
      await expect(within(region).getByText('Expressão: 1d20+5')).toBeVisible();
    }
  },
};