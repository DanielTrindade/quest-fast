import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BestiaryList } from '../components/BestiaryList';
import { bestiary } from './fixtures/statblocks';

const meta = {
  title: 'Componentes/BestiaryList',
  component: BestiaryList,
  args: { statblocks: bestiary, onOpen: fn(), onCreate: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
} satisfies Meta<typeof BestiaryList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ComCriaturas: Story = {
  name: 'Com criaturas',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await userEvent.click(within(region).getByRole('button', { name: /^Goblin/ }));
    await expect(args.onOpen).toHaveBeenCalledWith('goblin');
  },
};

export const Vazio: Story = { args: { statblocks: [] } };

export const Busca: Story = {
  name: 'Busca sem acento',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const list = within(region);
      await userEvent.type(list.getByRole('searchbox', { name: 'Buscar criatura' }), 'guardiao');
      await expect(list.getAllByRole('listitem')).toHaveLength(1);
      await expect(list.getByRole('button', { name: /Guardião Esquecido/ })).toBeVisible();
    }
  },
};

export const BuscaSemResultado: Story = {
  name: 'Busca sem resultado',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const list = within(region);
      await userEvent.type(list.getByRole('searchbox', { name: 'Buscar criatura' }), 'beholder');
      await expect(list.getByRole('status')).toHaveTextContent('Nenhuma criatura com “beholder” no nome.');
    }
  },
};
