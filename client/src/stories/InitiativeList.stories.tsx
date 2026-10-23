import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { InitiativeList } from '../components/InitiativeList';
import {
  MASTER_ID,
  PLAYER_ID,
  awaitingInitiative,
  masterCombatants,
  playerCombatants,
  tiedCombatants,
} from './fixtures/encounters';

const meta = {
  title: 'Componentes/InitiativeList',
  component: InitiativeList,
  args: {
    combatants: masterCombatants,
    activeCombatantId: 'c-hazin',
    viewerId: MASTER_ID,
    master: true,
    onRoll: fn(),
    onAssign: fn(),
    onToggleHidden: fn(),
    onRemove: fn(),
    onMoveTie: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
} satisfies Meta<typeof InitiativeList>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Unfolds a combatant's "Ajustar" corrections. */
async function openAdjust(region: HTMLElement, name: string) {
  const summary = [...region.querySelectorAll('summary')].find((element) => element.textContent?.trim() === `Ajustar ${name}`);
  await expect(summary).toBeDefined();
  await userEvent.click(summary!);
}

/** Every number, the hidden bandit, a defeated goblin and a tie. */
export const Mestre: Story = {};

/** Allies in full; monsters only by health band, in every band; no bandit. */
export const Jogador: Story = {
  args: {
    combatants: playerCombatants,
    viewerId: PLAYER_ID,
    master: false,
    onAssign: undefined,
    onToggleHidden: undefined,
    onRemove: undefined,
    onMoveTie: undefined,
  },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const list = within(region);
      await expect(list.queryByText('Bandido')).toBeNull();
      await expect(list.getByText('Muito ferido')).toBeVisible();
      await expect(list.getByText('Ferido')).toBeVisible();
      await expect(list.getAllByText('Ileso').length).toBeGreaterThan(0);
      await expect(list.queryByRole('button')).toBeNull();
    }
  },
};

export const AguardandoIniciativa: Story = {
  name: 'Aguardando iniciativa (jogador)',
  args: {
    combatants: awaitingInitiative.map((combatant) =>
      combatant.source === 'character' ? combatant : { ...combatant, initiative: null, ac: null, hpMax: null, hpCurrent: null },
    ),
    activeCombatantId: null,
    viewerId: PLAYER_ID,
    master: false,
  },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region);
    // Only Hazin, the player's own character, offers a roll.
    const roll = list.getByRole('button', { name: 'Rolar iniciativa' });
    await userEvent.click(roll);
    await expect(args.onRoll).toHaveBeenCalledWith('c-hazin');
    await expect(list.getAllByRole('button')).toHaveLength(1);
  },
};

export const AguardandoIniciativaMestre: Story = {
  name: 'Aguardando iniciativa (mestre)',
  args: { combatants: awaitingInitiative, activeCombatantId: null },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region);
    await userEvent.type(list.getByLabelText('Iniciativa de Hazin Dan'), '14');
    await userEvent.click(list.getByRole('button', { name: 'Definir iniciativa de Hazin Dan' }));
    await expect(args.onAssign).toHaveBeenCalledWith('c-hazin', 14);
  },
};

export const Empate: Story = {
  args: { combatants: tiedCombatants, activeCombatantId: null },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region);
    await userEvent.click(list.getByRole('button', { name: 'Depois no empate: Goblin Arqueiro' }));
    await expect(args.onMoveTie).toHaveBeenCalledWith('t1', 'down');
    // Hazin also rolled 12, but with another Dexterity: not part of the tie.
    await expect(list.queryByRole('button', { name: /no empate: Hazin Dan/ })).toBeNull();
  },
};

export const RemoverEmDoisPassos: Story = {
  name: 'Remover em dois passos',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const list = within(region);
    await openAdjust(region, 'Goblin 4');
    await userEvent.click(list.getByRole('button', { name: 'Remover Goblin 4' }));
    await expect(args.onRemove).not.toHaveBeenCalled();
    await userEvent.click(list.getByRole('button', { name: 'Remover Goblin 4' }));
    await expect(args.onRemove).toHaveBeenCalledWith('g4');
  },
};

export const Revelar: Story = {
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await openAdjust(region, 'Bandido');
    await userEvent.click(within(region).getByRole('button', { name: 'Revelar Bandido' }));
    await expect(args.onToggleHidden).toHaveBeenCalledWith('bandit', false);
  },
};

export const Encerrado: Story = {
  args: { activeCombatantId: null, editable: false },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region).queryByRole('button')).toBeNull();
  },
};

export const Ocupado: Story = { args: { busyId: 'g1' } };

export const Vazio: Story = { args: { combatants: [] } };

export const NomesLongos: Story = {
  name: 'Nomes longos',
  args: {
    combatants: masterCombatants.map((combatant) => ({
      ...combatant,
      name: `${combatant.name}, Guardião Esquecido das Catacumbas Submersas de Vel’Tharon`,
      hpCurrent: combatant.hpCurrent === null ? null : 999,
      hpMax: combatant.hpMax === null ? null : 999,
      hpTemp: 99,
    })),
  },
};
