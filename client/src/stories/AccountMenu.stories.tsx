import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AccountMenu } from '../components/AccountMenu';

function Account({ compact = false, signingOut = false, onSignOut = () => {} }: {
  compact?: boolean; signingOut?: boolean; onSignOut?: () => void;
}) {
  return <div style={{ maxWidth: compact ? 64 : 248, padding: 8 }}>
    <AccountMenu name="Lia Martins" avatarUrl={null} onSignOut={onSignOut} signingOut={signingOut}
      compact={compact} side="bottom" />
  </div>;
}

const meta = { title: 'Componentes/AccountMenu', component: Account } satisfies Meta<typeof Account>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = { name: 'Padrão' };
export const Compacto: Story = { args: { compact: true } };
export const Saindo: Story = {
  args: { signingOut: true },
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    await userEvent.click(canvas.getByRole('button', { name: 'Conta de Lia Martins' }));
    const item = await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Saindo…' });
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    // axe always flags aria-controls beside aria-haspopup as "needs review",
    // and Radix sets it only while open: end the story with the menu closed.
    await userEvent.keyboard('{Escape}');
    await expect(item).not.toBeInTheDocument();
  },
};
export const Sair: Story = {
  args: { onSignOut: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    await userEvent.click(canvas.getByRole('button', { name: 'Conta de Lia Martins' }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Sair' }));
    await expect(args.onSignOut).toHaveBeenCalled();
  },
};
