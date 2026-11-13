import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TokenPicker } from '../components/TokenPicker';
import { pickerCharacters, pickerEncounters, pickerStatblocks } from './fixtures/tokens';

const meta = {
  title: 'Componentes/TokenPicker',
  component: TokenPicker,
  args: {
    characters: pickerCharacters,
    encounters: pickerEncounters,
    statblocks: pickerStatblocks,
    onAddCharacter: fn(),
    onAddCombatant: fn(),
    onPlaceEncounter: fn(),
    onAddStatblock: fn(),
    onAddFree: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof TokenPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Personagens: Story = {
  play: async ({ canvasElement, args }) => {
    const picker = firstTheme(canvasElement);
    await expect(picker.getByText('No mapa')).toBeVisible();
    await userEvent.click(picker.getByRole('button', { name: 'Pôr no mapa Mira Folhaverde' }));
    await expect(args.onAddCharacter).toHaveBeenCalledWith('c-mira');
  },
};

export const Encontro: Story = {
  play: async ({ canvasElement, args }) => {
    const picker = firstTheme(canvasElement);
    await userEvent.click(picker.getByRole('radio', { name: 'Encontro' }));
    // Kaelen is already there: three combatants are missing.
    await userEvent.click(picker.getByRole('button', { name: 'Colocar 3 combatentes' }));
    await expect(args.onPlaceEncounter).toHaveBeenCalledWith('e-ambush');
    await expect(picker.getByText('Escondido dos jogadores')).toBeVisible();
    await userEvent.click(picker.getByRole('button', { name: 'Pôr no mapa Goblin 2' }));
    await expect(args.onAddCombatant).toHaveBeenCalledWith('cb-goblin-2');

    await userEvent.selectOptions(picker.getByLabelText('Qual encontro'), 'e-crypt');
    await expect(picker.getByRole('button', { name: 'Todos já estão no mapa' })).toBeDisabled();
  },
};

export const Bestiario: Story = {
  name: 'Bestiário',
  play: async ({ canvasElement, args }) => {
    const picker = firstTheme(canvasElement);
    await userEvent.click(picker.getByRole('radio', { name: 'Bestiário' }));
    await userEvent.selectOptions(picker.getByLabelText('Criatura'), 'sb-ogre');
    await userEvent.click(picker.getByRole('button', { name: 'Pôr no mapa Ogro' }));
    await expect(args.onAddStatblock).toHaveBeenCalledWith('sb-ogre');
  },
};

export const Livre: Story = {
  play: async ({ canvasElement, args }) => {
    const picker = firstTheme(canvasElement);
    await userEvent.click(picker.getByRole('radio', { name: 'Livre' }));
    await userEvent.click(picker.getByRole('button', { name: 'Pôr no mapa' }));
    await expect(picker.getByText('Dê um nome ao token, com até 40 caracteres.')).toBeVisible();
    await expect(args.onAddFree).not.toHaveBeenCalled();

    await userEvent.type(picker.getByLabelText('Nome'), 'Barril de pólvora');
    await userEvent.selectOptions(picker.getByLabelText('Tamanho'), 'large');
    await userEvent.click(picker.getByRole('button', { name: 'Pôr no mapa' }));
    await expect(args.onAddFree).toHaveBeenCalledWith({ label: 'Barril de pólvora', size: 'large' });
  },
};

export const SemOrigens: Story = {
  name: 'Campanha sem personagens, encontros nem bestiário',
  args: { characters: [], encounters: [], statblocks: [] },
};

export const Cheia: Story = {
  name: 'Cena cheia',
  args: { full: true },
  play: async ({ canvasElement }) => {
    const picker = firstTheme(canvasElement);
    await expect(picker.getByText(/A cena já tem 200 tokens/)).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Pôr no mapa Mira Folhaverde' })).toBeDisabled();
  },
};
