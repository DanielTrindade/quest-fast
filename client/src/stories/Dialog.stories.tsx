import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/Button';
import { Field } from '../components/Field';

function Example() {
  const [open, setOpen] = useState(false);
  return <Dialog trigger={<Button>Criar campanha</Button>} title="Uma nova aventura"
    description="Dê um nome à campanha. Você poderá convidar sua mesa em seguida." open={open} onOpenChange={setOpen}>
    <form onSubmit={event => { event.preventDefault(); setOpen(false); }}>
      <Field label="Nome da campanha" required placeholder="Ex.: Ecos de Phandalin" />
      <div className="qf-dialog__actions"><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Criar campanha</Button></div>
    </form>
  </Dialog>;
}
const meta = { title: 'Componentes/Dialog', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const TecladoEFoco: Story = { name: 'Teclado e foco', play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    const trigger = canvas.getByRole('button', { name: 'Criar campanha' });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: 'Uma nova aventura' });
    const field = within(dialog).getByRole('textbox', { name: 'Nome da campanha' });
    await waitFor(() => expect(field).toHaveFocus());
    for (let index = 0; index < 6; index++) {
      await userEvent.tab();
      await expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  }
} };
