import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SpellList } from '../components/SpellList';
import { SpellSlots } from '../components/SpellSlots';
import { SpellcastingHeader } from '../components/SpellcastingHeader';
import { lyraVentoclaro } from './fixtures/characters';

/** The second page of the official sheet: casting values, slots and spells. */
function Spellcasting({ editable = true, empty = false }: { editable?: boolean; empty?: boolean }) {
  const [slots, setSlots] = useState(empty ? lyraVentoclaro.spellSlots.map(() => ({ total: 0, spent: 0 })) : lyraVentoclaro.spellSlots);
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
      <SpellcastingHeader abilityLabel="Sabedoria" modifier={4} saveDc={15} attackBonus={7}
        onRollAttack={editable ? fn() : undefined} />
      <SpellSlots slots={slots} editable={editable}
        onChange={(spent) => setSlots((current) => current.map((slot, circle) => ({ ...slot, spent: spent[circle] ?? slot.spent })))} />
      <SpellList spells={empty ? [] : lyraVentoclaro.spells} />
    </div>
  );
}

const meta = { title: 'Componentes/Spellcasting', component: Spellcasting } satisfies Meta<typeof Spellcasting>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dono: Story = {};
export const Consulta: Story = { args: { editable: false } };
export const SemMagias: Story = { name: 'Sem magias', args: { empty: true } };

export const GastarEspaco: Story = {
  name: 'Gastar espaço',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const pip = within(region).getByRole('button', { name: 'Gastar espaço 2 do 2º círculo' });
      await userEvent.click(pip);
      await expect(pip).toHaveAttribute('aria-pressed', 'true');
      await expect(within(region).getByText('1 de 3 livres')).toBeVisible();
    }
  },
};
