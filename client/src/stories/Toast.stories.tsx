import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Button } from '../components/Button';
import { useNotify } from '../hooks/use-notify';

const COPY = {
  success: { title: 'Campanha criada', description: 'Agora você pode convidar sua mesa.' },
  error: { title: 'Não foi possível salvar', description: 'Verifique a conexão e tente novamente.' },
  info: { title: 'Convite atualizado', description: 'Compartilhe o novo código com os jogadores.' },
};

function Example({ variant = 'success' }: { variant?: 'success' | 'error' | 'info' }) {
  const notify = useNotify();
  return <Button onClick={() => notify({ variant, ...COPY[variant] })}>Mostrar notificação</Button>;
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
