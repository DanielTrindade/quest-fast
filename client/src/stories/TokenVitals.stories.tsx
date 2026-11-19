import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TokenVitals } from '../components/TokenVitals';

const goblin = { hpCurrent: 3, hpMax: 7, hpTemp: 0, healthBand: 'bloodied', defeated: false } as const;

const meta = {
  title: 'Componentes/TokenVitals',
  component: TokenVitals,
  args: { name: 'Goblin 2', vitals: goblin },
  decorators: [(Story) => <div style={{ maxWidth: 288 }}><Story /></div>],
} satisfies Meta<typeof TokenVitals>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The master adjusts a monster's hit points from its token. */
export const Mestre: Story = {
  args: { adjust: { pending: false, onApply: fn() } },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const panel = within(within(region!).getByRole('region', { name: 'Goblin 2' }));
    await expect(panel.getByText('3')).toBeVisible();
    await userEvent.type(panel.getByLabelText('Quantidade'), '2');
    await userEvent.click(panel.getByRole('button', { name: 'Dano em Goblin 2' }));
    await expect(args.adjust!.onApply).toHaveBeenCalledWith('damage', 2);
  },
};

/** A player reads a monster's hit points, with nothing to change them. */
export const Jogador: Story = {
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const panel = within(region!);
    await expect(panel.getByText('Pontos de vida')).toBeVisible();
    await expect(panel.queryByRole('button')).toBeNull();
  },
};

export const Derrotado: Story = {
  args: { vitals: { hpCurrent: 0, hpMax: 7, hpTemp: 0, healthBand: 'defeated', defeated: true } },
};

export const ComTemporarios: Story = {
  name: 'Com temporários',
  args: { name: 'Hazin Dan', vitals: { hpCurrent: 40, hpMax: 55, hpTemp: 8, healthBand: 'wounded', defeated: false }, adjust: { pending: false, onApply: fn() } },
};

/** A free bestiary token out of the fight: the master puts it in, with rolled hit points. */
export const EntrarNoCombate: Story = {
  name: 'Entrar no combate',
  args: {
    name: 'Goblin',
    vitals: null,
    join: { encounterName: 'Emboscada na estrada', hasFormula: true, pending: false, onJoin: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const panel = within(region!);
    await userEvent.selectOptions(panel.getByLabelText('Pontos de vida'), 'rolled');
    await userEvent.click(panel.getByRole('button', { name: /^Entrar no combate/ }));
    await expect(args.join!.onJoin).toHaveBeenCalledWith('rolled');
  },
};

export const SemEncontro: Story = {
  name: 'Sem encontro aberto',
  args: { name: 'Goblin', vitals: null, join: { encounterName: null, hasFormula: true, pending: false, onJoin: fn() } },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText(/Crie um encontro em Combate/)).toBeVisible();
    await expect(within(region!).queryByRole('button')).toBeNull();
  },
};

export const Entrando: Story = {
  args: { name: 'Goblin', vitals: null, join: { encounterName: 'Emboscada na estrada', hasFormula: false, pending: true, onJoin: fn() } },
};
