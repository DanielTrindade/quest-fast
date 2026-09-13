import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { DeathSaves as DeathSavesValue } from '@quest-fast/shared';
import { DeathSaves } from '../components/DeathSaves';
import { HeroicInspiration } from '../components/HeroicInspiration';
import { HitDiceTracker } from '../components/HitDiceTracker';
import { HitPointsTracker } from '../components/HitPointsTracker';

/** The session-state trackers of the official sheet, driven by local state. */
function Trackers({ editable = true, hpCurrent = 30, hpTemp = 5, hpMax = 55, spent = 1, successes = 0, failures = 0, inspired = false }: {
  editable?: boolean; hpCurrent?: number; hpTemp?: number; hpMax?: number; spent?: number; successes?: number; failures?: number; inspired?: boolean;
}) {
  const [hitPoints, setHitPoints] = useState({ hpCurrent, hpTemp });
  const [hitDiceSpent, setHitDiceSpent] = useState(spent);
  const [deathSaves, setDeathSaves] = useState<DeathSavesValue>({ successes, failures });
  const [inspiration, setInspiration] = useState(inspired);
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
      <HitPointsTracker {...hitPoints} hpMax={hpMax} editable={editable} onChange={setHitPoints} />
      <HitDiceTracker hitDie={12} level={4} spent={hitDiceSpent} editable={editable} onChange={setHitDiceSpent} />
      <DeathSaves value={deathSaves} editable={editable} onChange={setDeathSaves} />
      <HeroicInspiration active={inspiration} editable={editable} onChange={setInspiration} />
    </div>
  );
}

const meta = { title: 'Componentes/CombatTrackers', component: Trackers } satisfies Meta<typeof Trackers>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dono: Story = {};
export const Consulta: Story = { args: { editable: false, inspired: true, successes: 1, failures: 2 } };
export const Caido: Story = { name: 'Caído', args: { hpCurrent: 0, hpTemp: 0, successes: 2, failures: 1 } };
export const Extremos: Story = { args: { hpCurrent: 999, hpTemp: 999, hpMax: 999, spent: 4, inspired: true } };

export const Interativo: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.type(canvas.getByLabelText('Quantidade'), '7');
      await userEvent.click(canvas.getByRole('button', { name: 'Dano' }));
      // 5 temporary points soak the first 5 of 7: 30 becomes 28.
      await expect(canvas.getByText('28')).toBeVisible();
      await userEvent.click(canvas.getByRole('button', { name: 'Gastar um dado de vida' }));
      await expect(canvas.getByText('2 gastos')).toBeVisible();
      await userEvent.click(canvas.getByRole('button', { name: 'Falhas: 2' }));
      await expect(canvas.getByRole('button', { name: 'Falhas: 2' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(canvas.getByRole('button', { name: 'Sem inspiração' }));
      await expect(canvas.getByRole('button', { name: 'Inspirado' })).toHaveAttribute('aria-pressed', 'true');
    }
  },
};
