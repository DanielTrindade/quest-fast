import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ReminderList } from '../components/ReminderList';

const meta = {
  title: 'Componentes/ReminderList',
  component: ReminderList,
  args: {
    name: 'Lyra Ventoclaro',
    reminders: [
      { id: 'r1', kind: 'concentration', dc: 12 },
      { id: 'r2', kind: 'deathFailure' },
    ],
    onRollSave: fn(),
    onRecordFailure: fn(),
    onDismiss: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof ReminderList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pendencias: Story = {
  name: 'Pendências',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await userEvent.click(list.getByRole('button', { name: 'Rolar salvaguarda de Lyra Ventoclaro' }));
    await expect(args.onRollSave).toHaveBeenCalledWith('r1');
    await userEvent.click(list.getByRole('button', { name: 'Uma falha para Lyra Ventoclaro' }));
    await expect(args.onRecordFailure).toHaveBeenCalledWith('r2', 1);
    await userEvent.click(list.getAllByRole('button', { name: 'Dispensar o lembrete de Lyra Ventoclaro' })[0]!);
    await expect(args.onDismiss).toHaveBeenCalledWith('r1');
  },
};

/** An ally's reminders: the table sees them; only the owner and the master act. */
export const SomenteLeitura: Story = {
  name: 'Somente leitura',
  args: { onRollSave: undefined, onRecordFailure: undefined, onDismiss: undefined },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).queryByRole('button')).toBeNull();
    await expect(within(region!).getByText(/CD 12/)).toBeVisible();
  },
};

/** Several hits while concentrating: one save each. */
export const VariasSalvaguardas: Story = {
  name: 'Várias salvaguardas',
  args: { reminders: [{ id: 'a', kind: 'concentration', dc: 10 }, { id: 'b', kind: 'concentration', dc: 30 }] },
};
