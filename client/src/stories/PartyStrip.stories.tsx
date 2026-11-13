import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PartyStrip } from '../components/PartyStrip';
import { party, partyMember, worstCase } from './fixtures/my-characters';

const meta = {
  title: 'Componentes/PartyStrip',
  component: PartyStrip,
  args: { characters: party, currentUserId: 'daniel', onOpen: fn() },
} satisfies Meta<typeof PartyStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Grupo: Story = {
  play: async ({ canvasElement, args }) => {
    const strip = firstTheme(canvasElement);
    await userEvent.click(strip.getByRole('button', { name: /Lyra Ventoclaro, de Ana Beatriz/ }));
    await expect(args.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'lyra' }));
  },
};

export const PiorCaso: Story = {
  name: 'Pior caso',
  args: { characters: [partyMember(worstCase), ...party] },
};
