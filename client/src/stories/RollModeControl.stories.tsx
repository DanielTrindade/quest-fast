import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RollMode } from '@quest-fast/shared';
import { expect, userEvent, within } from 'storybook/test';
import { RollModeControl } from '../components/RollModeControl';
import { ROLL_MODE_LABELS } from '../lib/5e';

function Example({ initial = 'normal', disabled = false }: { initial?: RollMode; disabled?: boolean }) {
  const [mode, setMode] = useState<RollMode>(initial);
  return (
    <div className="qf-stack" style={{ maxWidth: 320 }}>
      <RollModeControl value={mode} onChange={setMode} disabled={disabled} />
      <p className="text-small text-text-secondary" aria-live="polite">Modo: {ROLL_MODE_LABELS[mode]}</p>
    </div>
  );
}

const meta = { title: 'Componentes/RollModeControl', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = { args: { initial: 'normal' } };
export const Vantagem: Story = { args: { initial: 'advantage' } };
export const Desvantagem: Story = { args: { initial: 'disadvantage' } };
export const Desabilitado: Story = { args: { disabled: true } };

export const Interativo: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByText('Vantagem'));
      await expect(within(region).getByText('Modo: Vantagem')).toBeVisible();
      await userEvent.click(within(region).getByText('Desvantagem'));
      await expect(within(region).getByText('Modo: Desvantagem')).toBeVisible();
    }
  },
};