import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Button } from '../../components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

function Example() {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button>Criar campanha</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Uma nova aventura</DialogTitle>
        <DialogDescription>Dê um nome à campanha. Você poderá convidar sua mesa em seguida.</DialogDescription>
      </DialogHeader>
      <form className="grid gap-6" onSubmit={event => { event.preventDefault(); setOpen(false); }}>
        <div className="grid gap-2">
          <Label htmlFor={id}>Nome da campanha</Label>
          <Input id={id} required placeholder="Ex.: Ecos de Phandalin" />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
          <Button type="submit">Criar campanha</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

const meta = { title: 'Primitivos/Dialog', component: Example } satisfies Meta<typeof Example>;
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
