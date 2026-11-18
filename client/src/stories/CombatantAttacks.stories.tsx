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
    await userEvent.click(within(panel.getByRole('group', { name: 'Alvos de Goblin 1' })).getByRole('checkbox', { name: /^Hazin Dan —/ }));
    await userEvent.click(panel.getByRole('radio', { name: 'Vantagem' }));
    await userEvent.click(panel.getByRole('button', { name: 'Atacar com Cimitarra' }));
    await expect(args.onAttack).toHaveBeenCalledWith(0, { targetIds: ['c-hazin'], mode: 'advantage', secret: true });
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
    await expect(panel.queryByRole('checkbox', { name: /Atacar em segredo/ })).toBeNull();
    // A save has no attack roll: the mode does not travel with it.
    await userEvent.click(panel.getByRole('radio', { name: 'Desvantagem' }));
    await userEvent.click(panel.getByRole('button', { name: 'Rolar dano de Sopro de fogo' }));
    await expect(args.onAttack).toHaveBeenCalledWith(1, { targetIds: [], mode: 'normal', secret: false });
  },
};

export const Enviando: Story = { args: { pending: true } };

export const SemAtaques: Story = { name: 'Sem ataques', args: { name: 'Bandido', attacks: [] } };

/**
 * On its turn, Hazin has spent the action: the Attack action row and the
 * spell are off and say why; the off-hand axe still has the bonus action.
 */
export const TurnoGasto: Story = {
  name: 'Turno com a ação gasta',
  args: {
    name: 'Hazin Dan',
    attacks: [
      ...hazin.attacks,
      { kind: 'attack', cost: 'bonusAction', name: 'Machadinha (mão inábil)', bonus: 7, damage: '1d6', damageType: 'Cortante', notes: 'Leve' },
    ],
    targets: playerCombatants.filter((combatant) => combatant.id !== 'c-hazin'),
    master: false,
    defaultSecret: false,
    active: true,
    turn: {
      actionUsed: true, bonusActionUsed: false, reactionUsed: false, attacksLeft: 0, extraActions: 0, dashes: 0, movementUsed: 0,
      speed: 9, movementLeft: 9, attacksPerAction: 2,
    },
  },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const panel = within(region!);
    await expect(panel.getByRole('button', { name: 'Atacar com Machado Grande' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Rolar dano de Sopro de fogo' })).toBeDisabled();
    await expect(panel.getAllByText('Não há ataque nem ação sobrando neste turno.')[0]).toBeVisible();
    await expect(panel.getByText('Ação bônus')).toBeVisible();
    await userEvent.click(panel.getByRole('button', { name: 'Atacar com Machadinha (mão inábil)' }));
    await expect(args.onAttack).toHaveBeenCalledWith(2, { targetIds: [], mode: 'normal', secret: false });
  },
};

/**
 * Two targets ticked: the breath (a save) reaches both, the axe (an attack
 * roll) takes one target and says so.
 */
export const VariosAlvos: Story = {
  name: 'Vários alvos (área)',
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
    const targets = within(panel.getByRole('group', { name: 'Alvos de Hazin Dan' }));
    await userEvent.click(targets.getByRole('checkbox', { name: /^Goblin 1 —/ }));
    await userEvent.click(targets.getByRole('checkbox', { name: /^Goblin 2 —/ }));
    await expect(panel.getByRole('button', { name: 'Atacar com Machado Grande' })).toBeDisabled();
    await expect(panel.getByText('Um ataque com rolagem de acerto tem um alvo só.')).toBeVisible();
    await userEvent.click(panel.getByRole('button', { name: 'Rolar dano de Sopro de fogo' }));
    await expect(args.onAttack).toHaveBeenCalledWith(1, { targetIds: ['g1', 'g2'], mode: 'normal', secret: false });
  },
};
