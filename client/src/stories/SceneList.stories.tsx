import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SceneList } from '../components/SceneList';
import { sceneList, syntheticMapUrl } from './fixtures/maps';

const meta = {
  title: 'Componentes/SceneList',
  component: SceneList,
  args: {
    scenes: [],
    onCreate: fn(),
    onView: fn(),
    onOpenForTable: fn(),
    onCloseTable: fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
  render: (args) => <SceneList {...args} scenes={args.scenes.length > 0 ? args.scenes : []} />,
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
} satisfies Meta<typeof SceneList>;
export default meta;
type Story = StoryObj<typeof meta>;

const withScenes: Story['render'] = (args) => <SceneList {...args} scenes={sceneList(syntheticMapUrl())} />;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Mestre: Story = {
  render: withScenes,
  play: async ({ canvasElement, args }) => {
    const list = firstTheme(canvasElement);
    await expect(list.getByText('Aberta para a mesa')).toBeVisible();
    await userEvent.click(list.getByRole('button', { name: 'Fechar para a mesa' }));
    await expect(args.onCloseTable).toHaveBeenCalled();
    await userEvent.click(list.getAllByRole('button', { name: 'Abrir para a mesa' })[0]);
    await expect(args.onOpenForTable).toHaveBeenCalledWith('s-road');
    await userEvent.click(list.getByRole('button', { name: 'Ver mapa de Estrada de Triboar' }));
    await expect(args.onView).toHaveBeenCalledWith('s-road');
  },
};

export const Excluir: Story = {
  name: 'Excluir em dois passos',
  render: withScenes,
  play: async ({ canvasElement, args }) => {
    const list = firstTheme(canvasElement);
    await userEvent.click(list.getByRole('button', { name: 'Excluir Salão em ruínas' }));
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(list.getByText(/tela dos jogadores/)).toBeVisible();
    await userEvent.click(list.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(list.getByRole('button', { name: 'Excluir Estrada de Triboar' }));
    await userEvent.click(list.getByRole('button', { name: 'Excluir cena' }));
    await expect(args.onDelete).toHaveBeenCalledWith('s-road');
  },
};

export const Abrindo: Story = {
  name: 'Abrindo para a mesa',
  args: { pendingSceneId: 's-road' },
  render: withScenes,
};

export const Vazia: Story = {
  play: async ({ canvasElement, args }) => {
    const list = firstTheme(canvasElement);
    await userEvent.click(list.getByRole('button', { name: 'Criar cena' }));
    await expect(args.onCreate).toHaveBeenCalled();
  },
};
