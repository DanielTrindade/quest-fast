import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EncounterList } from '../components/EncounterList';
import '../styles/campaign.css';
import { encounterList } from './fixtures/encounters';

const meta = {
  title: 'Componentes/EncounterList',
  component: EncounterList,
  args: { encounters: encounterList, onOpen: fn(), onCreate: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
} satisfies Meta<typeof EncounterList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mestre: Story = {
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region);
    await userEvent.click(list.getByRole('button', { name: /Emboscada na estrada/ }));
    await expect(args.onOpen).toHaveBeenCalledWith('e-active');
  },
};

export const CriarEncontro: Story = {
  name: 'Criar encontro',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region);
    await userEvent.click(list.getByRole('button', { name: 'Preparar encontro' }));
    await expect(args.onCreate).not.toHaveBeenCalled();
    await expect(list.getByText(/Dê um nome ao encontro/)).toBeVisible();
    await userEvent.type(list.getByLabelText('Nome do novo encontro'), 'Covil do dragão');
    await userEvent.click(list.getByRole('button', { name: 'Preparar encontro' }));
    await expect(args.onCreate).toHaveBeenCalledWith('Covil do dragão');
  },
};

export const MestreSemEncontros: Story = { name: 'Mestre sem encontros', args: { encounters: [] } };

export const Jogador: Story = {
  args: { encounters: encounterList.filter((encounter) => encounter.status !== 'preparing'), onCreate: undefined },
};

export const JogadorSemCombate: Story = { name: 'Jogador sem combate', args: { encounters: [], onCreate: undefined } };
