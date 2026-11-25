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

/** A resistance of the target already halved it: the master reads why, and may apply the roll instead. */
export const DanoPendenteResistencia: Story = {
  name: 'Dano pendente com resistência',
  args: { name: 'Goblin 2', reminders: [{ ...pendingDamage, amount: 7, rolled: 14, adjustment: 'resistant' }], master: true, onApplyDamage: fn() },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await expect(list.getByText(/Resistência a cortante: rolou 14\./)).toBeVisible();
    await userEvent.click(list.getByRole('button', { name: /^Aplicar 14/ }));
    await expect(args.onApplyDamage).toHaveBeenLastCalledWith('d1', 14);
  },
};

/** An immunity left 0: nothing goes until the master types an amount. */
export const DanoPendenteImune: Story = {
  name: 'Dano pendente com imunidade',
  args: { name: 'Goblin 2', reminders: [{ ...pendingDamage, amount: 0, rolled: 14, adjustment: 'immune' }], master: true, onApplyDamage: fn() },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByRole('button', { name: 'Aplicar o dano em Goblin 2' })).toBeDisabled();
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

/** The server rolled the save and the target passed: the amount already is the half. */
export const DanoPendenteSalvaguardaRolada: Story = {
  name: 'Dano pendente com salvaguarda rolada',
  args: {
    name: 'Hazin Dan',
    reminders: [{ ...pendingDamage, critical: false, amount: 4, damageType: 'Fogo', attackerName: 'Goblin xamã', attackName: 'Raio de fogo', save: { dc: 13, ability: 'dexterity', success: true } }],
    master: true,
    onApplyDamage: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await expect(list.getByText(/Passou na salvaguarda de Destreza CD 13: já é a metade/)).toBeVisible();
    await expect(list.queryByRole('button', { name: 'Metade do dano em Hazin Dan' })).toBeNull();
    await userEvent.click(list.getByRole('button', { name: 'Aplicar o dano em Hazin Dan' }));
    await expect(args.onApplyDamage).toHaveBeenCalledWith('d1', undefined);
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

const pendingSave = {
  id: 's1',
  kind: 'pendingSave',
  dc: 12,
  ability: 'dexterity',
  attackerName: 'Bruxa',
  attackName: 'Graxa',
  notes: 'Cai se falhar',
  eventId: 'e2',
  secret: false,
} as const;

/** A save without damage: the target rolls it at the table, then it is marked resolved. */
export const SalvaguardaPendente: Story = {
  name: 'Salvaguarda sem dano',
  args: { name: 'Hazin Dan', reminders: [pendingSave], onDismiss: fn() },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region!);
    await expect(list.getByText('Salvaguarda de Destreza CD 12 contra Graxa de Bruxa, sem dano. Cai se falhar.')).toBeVisible();
    await userEvent.click(list.getByRole('button', { name: 'Resolvido a salvaguarda de Hazin Dan' }));
    await expect(args.onDismiss).toHaveBeenLastCalledWith('s1');
  },
};

/** The server rolled the save and the target failed: the master applies the effect. */
export const SalvaguardaFalhou: Story = {
  name: 'Salvaguarda sem dano que falhou',
  args: { name: 'Goblin 1', reminders: [{ ...pendingSave, failed: true }], master: true, onDismiss: fn() },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText('Falhou na salvaguarda de Destreza CD 12 contra Graxa de Bruxa: aplique o efeito. Cai se falhar.')).toBeVisible();
  },
};
