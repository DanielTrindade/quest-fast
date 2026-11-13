import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MasterActions, type MasterFight } from '../components/MasterActions';
import { Button } from '../components/ui/button';
import { downedMaster, masterCombatants } from './fixtures/encounters';
import { masterWithHits } from './fixtures/table';

function fightOf(combatants = masterWithHits, activeCombatantId: string | null = 'g1'): MasterFight {
  return {
    name: 'Emboscada na estrada',
    combatants,
    activeCombatantId,
    busyIds: [],
    actions: {
      onHitPoints: fn(), onApplyCondition: fn(), onRemoveCondition: fn(), onConcentration: fn(), onDeathSave: fn(),
      onRecordFailure: fn(), onConcentrationSave: fn(), onDismissReminder: fn(), onAttack: fn(), onApplyDamage: fn(),
      onToggleHidden: fn(), onRoll: fn(),
    },
  };
}

const meta = {
  title: 'Componentes/MasterActions',
  component: MasterActions,
  args: { fight: fightOf(), emptyAction: <Button variant="secondary">Ir para o Preparo</Button> },
  decorators: [(Story) => <div style={{ maxWidth: 380 }}><Story /></div>],
} satisfies Meta<typeof MasterActions>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/**
 * Two hits wait on the master, from the whole fight; below, the goblin whose
 * turn it is, attacking in secret by default.
 */
export const DanoPendente: Story = {
  name: 'Dano pendente e a vez do goblin',
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Aplicar o dano em Goblin 1' }));
    await expect(args.fight!.actions.onApplyDamage).toHaveBeenCalledWith('g1', 'd-g1', undefined);
    await expect(panel.getByRole('checkbox', { name: /Atacar em segredo/ })).toBeChecked();
  },
};

/** Picking someone else stops following the turn; one button goes back to it. */
export const OutroCombatente: Story = {
  name: 'Outro combatente',
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.selectOptions(panel.getByLabelText('Combatente'), 'bandit');
    await expect(panel.getByRole('heading', { name: 'Bandido' })).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: /^Revelar para a mesa/ }));
    await expect(args.fight!.actions.onToggleHidden).toHaveBeenCalledWith('bandit', false);
    await userEvent.click(panel.getByRole('button', { name: 'Voltar para a vez de Goblin 1' }));
    await expect(panel.getByRole('heading', { name: 'Goblin 1' })).toBeInTheDocument();
  },
};

export const SemDanoPendente: Story = { name: 'Sem dano pendente', args: { fight: fightOf(masterCombatants, 'c-hazin') } };

/** Hazin down on his turn: the master marks the failure or rolls for him. */
export const PersonagemCaido: Story = { name: 'Personagem caído', args: { fight: fightOf(downedMaster, 'c-hazin') } };

export const SemCombate: Story = { name: 'Sem combate', args: { fight: null } };
