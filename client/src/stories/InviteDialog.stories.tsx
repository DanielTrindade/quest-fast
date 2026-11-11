import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { InviteDialog } from '../components/InviteDialog';
import { Dialog, DialogContent } from '../components/ui/dialog';

function Example(props: Partial<ComponentProps<typeof InviteDialog>>) {
  return <Dialog open modal={false} onOpenChange={() => {}}>
    <DialogContent onInteractOutside={event => event.preventDefault()} onOpenAutoFocus={event => event.preventDefault()}>
      <InviteDialog link="https://questfast.app/invite/MESA42" code="MESA42" campaignName="Ecos de Phandalin" onRotate={() => {}} {...props} />
    </DialogContent>
  </Dialog>;
}

const meta = { title: 'Componentes/InviteDialog', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = { name: 'Padrão' };

export const ConfirmandoTroca: Story = {
  name: 'Confirmando troca',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('button', { name: 'Gerar novo link' }));
      await expect(canvas.getByText('O link atual vai parar de funcionar')).toBeInTheDocument();
      await userEvent.click(canvas.getByRole('button', { name: 'Cancelar' }));
      await expect(canvas.queryByText('O link atual vai parar de funcionar')).not.toBeInTheDocument();
      await userEvent.click(canvas.getByRole('button', { name: 'Gerar novo link' }));
    }
  },
};

export const FocoNaConfirmacao: Story = {
  name: 'Foco na confirmação',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('button', { name: 'Gerar novo link' }));
      const confirm = canvas.getByRole('button', { name: 'Gerar novo link' });
      await waitFor(() => expect(confirm).toHaveFocus());
      await expect(confirm).toHaveAccessibleDescription('O link atual vai parar de funcionar');
      await userEvent.click(canvas.getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(canvas.getByRole('button', { name: 'Gerar novo link' })).toHaveFocus());
      await expect(canvas.queryByText('O link atual vai parar de funcionar')).not.toBeInTheDocument();
    }
  },
};

export const ConfirmaTroca: Story = {
  name: 'Confirma a troca',
  args: { onRotate: fn() },
  play: async ({ canvasElement, args }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('button', { name: 'Gerar novo link' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Gerar novo link' }));
    }
    await expect(args.onRotate).toHaveBeenCalledTimes(2);
  },
};

export const Trocando: Story = { args: { rotating: true } };

export const ErroNaTroca: Story = {
  name: 'Erro na troca',
  args: { rotateError: 'Não foi possível gerar um novo link. Tente de novo.' },
};

export const LinkLongo: Story = {
  args: {
    link: 'https://questfast.app/invite/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    code: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    campaignName: 'Supercalifragilisticoexpialidosoimpossivelmentelongosemquebras',
  },
};
