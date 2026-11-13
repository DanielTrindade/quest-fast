import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { HeroCard } from '../components/HeroCard';
import { Button } from '../components/ui/button';
import { elara, hazin, tobias, worstCase } from './fixtures/my-characters';

const meta = {
  title: 'Componentes/HeroCard',
  component: HeroCard,
  args: { character: hazin, onOpen: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
} satisfies Meta<typeof HeroCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Ativo: Story = {
  name: 'Ativo, sem retrato',
  play: async ({ canvasElement, args }) => {
    const card = firstTheme(canvasElement);
    await expect(card.getByText('Ativo na mesa')).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: 'Abrir ficha de Hazin Dan' }));
    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const ComRetrato: Story = {
  name: 'Com retrato',
  args: { character: elara },
};

export const NaReserva: Story = {
  name: 'Na reserva, com ação',
  args: {
    character: tobias,
    actions: <Button variant="secondary" size="sm">Ativar nesta campanha</Button>,
  },
};

export const PiorCaso: Story = {
  name: 'Pior caso',
  args: { character: worstCase },
};
