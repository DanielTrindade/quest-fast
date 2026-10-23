import type { Meta, StoryObj } from '@storybook/react-vite';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import { expect, within } from 'storybook/test';
import { Button } from '../components/Button';
import { StatblockCard } from '../components/StatblockCard';
import { goblin, semExtras, textosLongos, wyrmDasCinzas } from './fixtures/statblocks';

const meta = {
  title: 'Componentes/StatblockCard',
  component: StatblockCard,
  args: { statblock: goblin },
  decorators: [(Story) => <div style={{ maxWidth: 640 }}><Story /></div>],
} satisfies Meta<typeof StatblockCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Goblin: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const card = within(region);
      // Initiative: Dexterity 14 (+2) plus a bonus of 0, passive 12.
      await expect(card.getByText('passiva (12)')).toBeVisible();
      await expect(card.getByText('Cimitarra')).toBeVisible();
    }
  },
};

export const Completo: Story = { name: 'Completo (dragão)', args: { statblock: wyrmDasCinzas } };

export const TextosLongos: Story = { name: 'Textos longos', args: { statblock: textosLongos } };

export const SemExtras: Story = {
  name: 'Sem fórmula, ND, ataques nem textos',
  args: { statblock: semExtras },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const card = within(region);
      await expect(card.queryByRole('heading', { name: 'Ações' })).toBeNull();
      await expect(card.queryByText(/^ND/)).toBeNull();
    }
  },
};

export const ComAcoes: Story = {
  name: 'Com ações do mestre',
  args: {
    statblock: goblin,
    actions: <>
      <Button variant="secondary"><PencilSimple size={18} aria-hidden="true" />Editar</Button>
      <Button variant="ghost" aria-label="Excluir Goblin"><Trash size={18} aria-hidden="true" /></Button>
    </>,
  },
};
