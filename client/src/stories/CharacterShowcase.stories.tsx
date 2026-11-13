import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CharacterShowcase } from '../components/CharacterShowcase';
import { Button } from '../components/ui/button';
import { elara, hazin, tobias, worstCase } from './fixtures/my-characters';

const meta = {
  title: 'Componentes/CharacterShowcase',
  component: CharacterShowcase,
  args: { character: hazin, onOpen: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 760 }}><Story /></div>],
} satisfies Meta<typeof CharacterShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const SemRetrato: Story = {
  name: 'Sem retrato',
  args: { actions: <Button size="sm">Ir para a mesa</Button> },
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.getByRole('heading', { name: 'Hazin Dan' })).toBeVisible();
    await expect(panel.getByText('Bárbaro de nível 4')).toBeVisible();
    await expect(panel.getByText('Classe de armadura', { exact: false })).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'Abrir ficha' }));
    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const ComRetrato: Story = {
  name: 'Com retrato',
  args: { character: elara, actions: <Button size="sm">Ir para a mesa</Button> },
};

export const NaReserva: Story = {
  name: 'Na reserva',
  args: { character: tobias, actions: <Button variant="secondary" size="sm">Ativar nesta campanha</Button> },
};

export const PiorCaso: Story = {
  name: 'Pior caso',
  args: { character: worstCase },
};

export const RetratoQuebrado: Story = {
  name: 'Retrato que não carrega',
  args: { character: { ...tobias, avatarUrl: '/avatars/removido-do-discord.png' } },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const view = within(region);
    // The broken image gives way to the token with the initials.
    await waitFor(() => expect(view.queryByRole('img', { name: /^Retrato de / })).toBeNull());
    await expect(view.getAllByRole('img', { name: 'Tobias Pé-de-Vento' })[0]).toBeVisible();
  },
};
