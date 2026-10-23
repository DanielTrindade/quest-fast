import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EncounterSetup } from '../components/EncounterSetup';
import '../styles/campaign.css';
import { bestiary } from './fixtures/statblocks';

const characters = [
  { id: 'hazin', name: 'Hazin Dan', ownerName: 'Daniel' },
  { id: 'lyra', name: 'Lyra Ventoclaro', ownerName: 'Carla' },
];

const meta = {
  title: 'Componentes/EncounterSetup',
  component: EncounterSetup,
  args: { characters, statblocks: bestiary, onAdd: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 640 }}><Story /></div>],
} satisfies Meta<typeof EncounterSetup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Bestiario: Story = {
  name: 'Bestiário',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    const count = form.getByLabelText('Quantidade');
    await userEvent.clear(count);
    await userEvent.type(count, '3');
    await userEvent.click(form.getByText('Rolados (2d6)'));
    await userEvent.click(form.getByRole('button', { name: 'Adicionar ao encontro' }));
    await expect(args.onAdd).toHaveBeenCalledWith({ source: 'statblock', statblockId: 'goblin', count: 3, hp: 'rolled', hidden: false });
  },
};

export const CriaturaSemFormula: Story = {
  name: 'Criatura sem fórmula de PV',
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    await userEvent.selectOptions(form.getByLabelText('Criatura'), 'lobo');
    await expect(form.getByRole('radio', { name: 'Rolados (sem fórmula)' })).toBeDisabled();
  },
};

export const Personagem: Story = {
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    await userEvent.click(form.getByText('Personagem'));
    await userEvent.selectOptions(form.getByRole('combobox', { name: 'Personagem' }), 'lyra');
    await userEvent.click(form.getByLabelText('Entra escondido dos jogadores'));
    await userEvent.click(form.getByRole('button', { name: 'Adicionar ao encontro' }));
    await expect(args.onAdd).toHaveBeenCalledWith({ source: 'character', characterId: 'lyra', hidden: true });
  },
};

export const TodosOsPersonagensJaEntraram: Story = {
  name: 'Todos os personagens já entraram',
  args: { characters: [], statblocks: [] },
};

export const ManualComErros: Story = {
  name: 'Manual com erros',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    await userEvent.click(form.getByText('Manual'));
    await userEvent.click(form.getByRole('button', { name: 'Adicionar ao encontro' }));
    await expect(args.onAdd).not.toHaveBeenCalled();
    await expect(form.getByLabelText(/^Nome/)).toHaveFocus();
    await expect(form.getByText('Informe o nome, com até 80 caracteres.')).toBeVisible();
  },
};

export const Manual: Story = {
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    await userEvent.click(form.getByText('Manual'));
    await userEvent.type(form.getByLabelText(/^Nome/), 'Bandido');
    await userEvent.type(form.getByLabelText(/^CA/), '12');
    await userEvent.type(form.getByLabelText(/^PV/), '11');
    await userEvent.type(form.getByLabelText('Iniciativa (opcional)'), '14');
    await userEvent.click(form.getByRole('button', { name: 'Adicionar ao encontro' }));
    await expect(args.onAdd).toHaveBeenCalledWith({
      source: 'manual', name: 'Bandido', ac: 12, hp: 11, size: 'medium', initiativeBonus: 0, initiative: 14, hidden: false,
    });
  },
};

export const Reforco: Story = { name: 'Reforço', args: { reinforcement: true, characters: [] } };

export const Enviando: Story = { args: { pending: true } };
