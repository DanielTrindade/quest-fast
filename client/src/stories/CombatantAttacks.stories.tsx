import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CombatantAttacks } from '../components/CombatantAttacks';
import { masterCombatants, playerCombatants } from './fixtures/encounters';

const goblin = masterCombatants.find((combatant) => combatant.id === 'g1')!;
const hazin = playerCombatants.find((combatant) => combatant.id === 'c-hazin')!;

const meta = {
  title: 'Componentes/CombatantAttacks',
  component: CombatantAttacks,
  args: {
    name: 'Goblin 1',
    attacks: goblin.attacks,
    targets: masterCombatants.filter((combatant) => combatant.id !== 'g1'),
    master: true,
    defaultSecret: true,
    onAttack: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof CombatantAttacks>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A monster attacks in secret unless the master unticks it. */
export const MestreComMonstro: Story = {
  name: 'Mestre com monstro',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const panel = within(region!);
    await expect(panel.getByRole('checkbox', { name: /Atacar em segredo/ })).toBeChecked();
    await userEvent.selectOptions(panel.getByLabelText('Alvo de Goblin 1'), 'c-hazin');
    await userEvent.click(panel.getByRole('radio', { name: 'Vantagem' }));
    await userEvent.click(panel.getByRole('button', { name: 'Atacar com Cimitarra' }));
    await expect(args.onAttack).toHaveBeenCalledWith(0, { targetId: 'c-hazin', mode: 'advantage', secret: true });
  },
};

/** A player attacks with their own character, never in secret. */
export const JogadorComPersonagem: Story = {
  name: 'Jogador com personagem',
  args: {
    name: 'Hazin Dan',
    attacks: hazin.attacks,
    targets: playerCombatants.filter((combatant) => combatant.id !== 'c-hazin'),
    master: false,
    defaultSecret: false,
  },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const panel = within(region!);
    await expect(panel.queryByRole('checkbox')).toBeNull();
    // A save has no attack roll: the mode does not travel with it.
    await userEvent.click(panel.getByRole('radio', { name: 'Desvantagem' }));
    await userEvent.click(panel.getByRole('button', { name: 'Rolar dano de Sopro de fogo' }));
    await expect(args.onAttack).toHaveBeenCalledWith(1, { targetId: null, mode: 'normal', secret: false });
  },
};

export const Enviando: Story = { args: { pending: true } };

export const SemAtaques: Story = { name: 'Sem ataques', args: { name: 'Bandido', attacks: [] } };
