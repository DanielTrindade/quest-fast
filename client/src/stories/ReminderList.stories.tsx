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

const pendingDamage = {
  id: 'd1',
  kind: 'pendingDamage',
  amount: 14,
  damageType: 'Cortante',
  critical: true,
  attackerName: 'Goblin 1',
  attackName: 'Cimitarra',
  eventId: 'e1',
  secret: false,
} as const;

/** The master applies a hit as rolled, or adjusted for a resistance. */
export const DanoPendenteMestre: Story = {
  name: 'Dano pendente (mestre)',
  args: { name: 'Hazin Dan', reminders: [pendingDamage], master: true, onApplyDamage: fn() },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    // Untouched, the roll goes whole: the server applies what it rolled.
    await userEvent.click(list.getByRole('button', { name: 'Aplicar o dano em Hazin Dan' }));
    await expect(args.onApplyDamage).toHaveBeenLastCalledWith('d1', undefined);
    const amount = list.getByLabelText('Quantidade');
    await userEvent.clear(amount);
    await userEvent.type(amount, '7');
    await userEvent.click(list.getByRole('button', { name: 'Aplicar o dano em Hazin Dan' }));
    await expect(args.onApplyDamage).toHaveBeenLastCalledWith('d1', 7);
    await userEvent.click(list.getByRole('button', { name: 'Descartar o dano em Hazin Dan' }));
    await expect(args.onDismiss).toHaveBeenCalledWith('d1');
  },
};

/** Against a save, the master may apply half. */
export const DanoPendenteSalvaguarda: Story = {
  name: 'Dano pendente com salvaguarda',
  args: {
    name: 'Hazin Dan',
    reminders: [{ ...pendingDamage, critical: false, amount: 9, damageType: 'Fogo', attackerName: 'Goblin xamã', attackName: 'Raio de fogo', save: { dc: 13, ability: 'dexterity' } }],
    master: true,
    onApplyDamage: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await expect(list.getByText(/CD 13 de Destreza: metade se passar/)).toBeVisible();
    await userEvent.click(list.getByRole('button', { name: 'Metade do dano em Hazin Dan' }));
    await expect(args.onApplyDamage).toHaveBeenCalledWith('d1', 4);
  },
};

/**
 * The master's screen before applying is wired: dropping a pending damage
 * does not wait for it.
 */
export const DanoPendenteMestreSoDescarte: Story = {
  name: 'Dano pendente (mestre, só descarte)',
  args: { name: 'Hazin Dan', reminders: [pendingDamage], master: true },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await expect(list.queryByText(/Aguardando o mestre/)).toBeNull();
    await userEvent.click(list.getByRole('button', { name: 'Dispensar o lembrete de Hazin Dan' }));
    await expect(args.onDismiss).toHaveBeenCalledWith('d1');
  },
};

/** The owner sees the hit waiting, with nothing to press: it is the master's call. */
export const DanoPendenteDono: Story = {
  name: 'Dano pendente (dono do personagem)',
  args: { name: 'Hazin Dan', reminders: [pendingDamage] },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).queryByRole('button')).toBeNull();
    await expect(within(region!).getByText(/Aguardando o mestre/)).toBeVisible();
  },
};
