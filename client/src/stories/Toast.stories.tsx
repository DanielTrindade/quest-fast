import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Toast, ToastProvider } from '../components/Toast';
import { Button } from '../components/Button';

function Example({ variant = 'success' }: { variant?: 'success' | 'error' | 'info' }) {
  const [open, setOpen] = useState(false);
  return <ToastProvider><Button onClick={() => setOpen(true)}>Mostrar notificação</Button>
    <Toast open={open} onOpenChange={setOpen} variant={variant}
      title={{ success: 'Campanha criada', error: 'Não foi possível salvar', info: 'Convite atualizado' }[variant]}
      description={{ success: 'Agora você pode convidar sua mesa.', error: 'Verifique a conexão e tente novamente.', info: 'Compartilhe o novo código com os jogadores.' }[variant]} />
  </ToastProvider>;
}
const meta = { title: 'Componentes/Toast', component: Example, args: { variant: 'success' },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('button', { name: 'Mostrar notificação' }));
      await canvas.findByRole('button', { name: 'Dispensar notificação' });
    }
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Sucesso: Story = {};
export const Erro: Story = { args: { variant: 'error' } };
export const Informacao: Story = { name: 'Informação', args: { variant: 'info' } };
export const Dispensar: Story = { play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('button', { name: 'Mostrar notificação' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Dispensar notificação' }));
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Dispensar notificação' })).not.toBeInTheDocument());
  }
} };
