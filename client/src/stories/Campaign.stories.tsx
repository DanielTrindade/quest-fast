import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Campaign } from './Campaign';
const meta = { title: 'Campanha', component: Campaign } satisfies Meta<typeof Campaign>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Mestre: Story = {};
export const Jogador: Story = { args: { role: 'player' } };
export const Carregando: Story = { args: { loading: true } };
export const AguardandoJogadores: Story = { args: { empty: true } };
export const GerenciarMembros: Story = { name: 'Gerenciar membros', play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('button', { name: 'Remover Rafael Costa' }));
    let dialog = within(await canvas.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByText('Rafael Costa')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Remover Rafael Costa' }));
    dialog = within(await canvas.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Remover jogador' }));
    await waitFor(() => expect(canvas.queryByText('Rafael Costa')).not.toBeInTheDocument());
    await expect(canvas.getByText('3 na mesa')).toBeInTheDocument();
  }
} };
