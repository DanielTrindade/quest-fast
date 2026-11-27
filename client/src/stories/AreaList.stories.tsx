import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AreaList } from '../components/AreaList';
import { manyAreas, sceneAreas } from './fixtures/areas';
import { MASTER_ID, PLAYER_ID, masterTokens } from './fixtures/tokens';

const meta = {
  title: 'Componentes/AreaList',
  component: AreaList,
  args: {
    areas: sceneAreas(),
    tokens: masterTokens(),
    viewerId: MASTER_ID,
    master: true,
    fadedIds: new Set(['glifo']),
    onToggleHidden: fn(),
    onRemove: fn(),
  },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
} satisfies Meta<typeof AreaList>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Mestre: Story = {
  play: async ({ canvasElement, args }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getByText('Segue Kaelen')).toBeInTheDocument();
    await expect(list.getByText('Oculta')).toBeInTheDocument();
    await userEvent.click(list.getByRole('button', { name: 'Revelar Glifo de Proteção' }));
    await expect(args.onToggleHidden).toHaveBeenCalledWith('glifo', false);
    await userEvent.click(list.getByRole('button', { name: 'Remover Teia' }));
    await userEvent.click(list.getByRole('button', { name: 'Remover Teia' }));
    await expect(args.onRemove).toHaveBeenCalledWith('teia');
  },
};

export const Jogador: Story = {
  args: {
    areas: sceneAreas().filter((area) => !area.hidden),
    viewerId: PLAYER_ID,
    master: false,
    fadedIds: new Set(),
    onToggleHidden: undefined,
  },
  play: async ({ canvasElement }) => {
    const list = firstTheme(canvasElement);
    // Only the player's own areas can be removed by them.
    await expect(list.getByRole('button', { name: 'Remover Névoa Obscurecente' })).toBeInTheDocument();
    await expect(list.queryByRole('button', { name: 'Remover Teia' })).not.toBeInTheDocument();
    await expect(list.queryByRole('button', { name: /^Ocultar/ })).not.toBeInTheDocument();
  },
};

export const Vazia: Story = {
  args: { areas: [] },
  play: async ({ canvasElement }) => {
    await expect(firstTheme(canvasElement).getByText(/Nenhuma área na cena/)).toBeInTheDocument();
  },
};

export const Cinquenta: Story = {
  name: 'Cinquenta áreas',
  args: { areas: manyAreas(), fadedIds: new Set() },
};
