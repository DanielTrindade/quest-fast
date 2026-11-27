import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { CombatantView, RollPayload } from '@quest-fast/shared';
import { PlayerActions, type PlayerFight } from '../components/PlayerActions';
import { Button } from '../components/ui/button';
import { hazinDan, lyraVentoclaro } from './fixtures/characters';
import { PORTRAIT, partyMember, worstCase } from './fixtures/my-characters';
import { downedPlayer, playerCombatants, summonedSpirit } from './fixtures/encounters';
import { playerWithHits } from './fixtures/table';

const hazinCharacter = { ...partyMember({ ...hazinDan, campaignName: 'Mesa de quinta' }), hpCurrent: 38, hpTemp: 5 };

function fightOf(combatants: CombatantView[], active = true): PlayerFight {
  const own = combatants.find((combatant) => combatant.id === 'c-hazin')!;
  return {
    combatant: own,
    targets: combatants.filter((combatant) => combatant.id !== own.id),
    active,
    busy: false,
    actions: { onHitPoints: fn(), onApplyCondition: fn(), onRemoveCondition: fn(), onConcentration: fn(), onDeathSave: fn(), onRecordFailure: fn(), onConcentrationSave: fn(), onDismissReminder: fn(), onAttack: fn(), onRoll: fn() },
  };
}

const lastRoll: RollPayload = {
  kind: 'roll', expression: '1d20+7', dice: [{ sides: 20, value: 14 }], modifier: 7, total: 21, mode: 'normal',
  rollKind: 'skill', characterId: 'hazin', characterName: 'Hazin Dan', skill: 'athletics',
};

const meta = {
  title: 'Componentes/PlayerActions',
  component: PlayerActions,
  args: {
    character: hazinCharacter,
    sheet: hazinDan,
    onRoll: fn(),
    onOpenSheet: fn(),
    galleryAction: <Button variant="secondary">Meus personagens</Button>,
  },
  decorators: [(Story) => <div style={{ maxWidth: 380 }}><Story /></div>],
} satisfies Meta<typeof PlayerActions>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** No fight: the character, its attacks rolled from the sheet and the tests. */
export const ForaDoCombate: Story = {
  name: 'Fora do combate',
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Atacar com Machado Grande Hetto' }));
    await expect(args.onRoll).toHaveBeenLastCalledWith({ kind: 'attack', attackIndex: 0, mode: 'normal' });
    await userEvent.click(panel.getByRole('button', { name: 'Abrir ficha' }));
    await expect(args.onOpenSheet).toHaveBeenCalled();
  },
};

export const ComRetrato: Story = { name: 'Com retrato', args: { character: { ...hazinCharacter, avatarUrl: PORTRAIT } } };

/** Its turn: the combatant with a target to attack, hit points and conditions. */
export const NaVez: Story = {
  name: 'Na vez, em combate',
  args: { fight: fightOf(playerCombatants) },
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(within(panel.getByRole('group', { name: 'Alvos de Hazin Dan' })).getByRole('checkbox', { name: /^Goblin 2 —/ }));
    await userEvent.click(panel.getByRole('button', { name: 'Atacar com Machado Grande' }));
    await expect(args.fight!.actions.onAttack).toHaveBeenCalledWith('c-hazin', 0, { targetIds: ['g2'], mode: 'normal', secret: false });
  },
};

const withSpirit = [...playerCombatants.slice(0, 2), summonedSpirit, ...playerCombatants.slice(2)];

/**
 * Hazin controls a summon (#114): "Agir com" picks who acts, the spirit's
 * controls are its own, and the player dismisses it.
 */
export const ComInvocacao: Story = {
  name: 'Com invocação',
  args: {
    fight: fightOf(withSpirit),
    summons: {
      controlled: [{ ...fightOf(withSpirit, false), combatant: summonedSpirit, targets: withSpirit.filter((combatant) => combatant.id !== 'c-spirit') }],
      onDismiss: fn(),
      summon: { pending: false, error: null, onSummon: fn() },
    },
  },
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('radio', { name: 'Espírito do Construto' }));
    await expect(panel.getByRole('heading', { name: 'Espírito do Construto' })).toBeVisible();
    await userEvent.click(panel.getByRole('button', { name: 'Atacar com Pancada' }));
    await expect(args.summons!.controlled[0]!.actions.onAttack).toHaveBeenCalledWith('c-spirit', 0, expect.objectContaining({ mode: 'normal' }));
    await userEvent.click(panel.getByRole('button', { name: 'Dispensar Espírito do Construto' }));
    await expect(args.summons!.onDismiss).toHaveBeenCalledWith('c-spirit');
  },
};

/** "Invocar" opens the simple sheet under the character's controls. */
export const Invocar: Story = {
  args: { fight: fightOf(playerCombatants), summons: { controlled: [], onDismiss: fn(), summon: { pending: false, error: null, onSummon: fn() } } },
  play: async ({ canvasElement }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Invocar' }));
    await expect(panel.getByRole('form', { name: 'Invocar com Hazin Dan' })).toBeVisible();
    await userEvent.click(panel.getByRole('button', { name: 'Cancelar' }));
    await expect(panel.getByRole('button', { name: 'Invocar' })).toBeVisible();
  },
};

/** Hit by a goblin: the damage waits on the master, and the player sees it. */
export const DanoAguardando: Story = { name: 'Dano aguardando o mestre', args: { fight: fightOf(playerWithHits, false) } };

/** Down on its own turn: the death save is the action. */
export const Caido: Story = { name: 'Caído', args: { fight: fightOf(downedPlayer) } };

export const EmOutroCombate: Story = { name: 'Fora do combate em andamento', args: { inOtherFight: true } };

export const ResultadoDaRolagem: Story = { name: 'Resultado da rolagem', args: { lastRoll } };

export const FichaCarregando: Story = { name: 'Ficha carregando', args: { sheet: undefined } };

export const SemPersonagem: Story = { name: 'Sem personagem ativo', args: { character: null } };

export const PiorCaso: Story = { name: 'Pior caso', args: { character: partyMember(worstCase), sheet: worstCase } };

/** The sheet failed after the retries: say so and offer to try again, never an endless skeleton. */
export const FichaComErro: Story = {
  name: 'Ficha com erro',
  args: { sheet: undefined, sheetError: 'Não foi possível carregar a ficha.', onRetrySheet: fn() },
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.getByRole('alert')).toHaveTextContent('Não foi possível carregar a ficha.');
    await userEvent.click(panel.getByRole('button', { name: 'Tentar novamente' }));
    await expect(args.onRetrySheet).toHaveBeenCalled();
  },
};

/** A caster: the slots and the spells that spend them, between the attacks and the tests. */
export const Conjuradora: Story = {
  args: {
    character: { ...partyMember({ ...lyraVentoclaro, campaignName: 'Mesa de quinta' }), hpCurrent: 22, hpTemp: 5 },
    sheet: lyraVentoclaro,
    spellcasting: { pending: false, error: null, onChangeSlots: fn(), onCast: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.getByRole('region', { name: 'Magias de Lyra Ventoclaro' })).toBeVisible();
    await userEvent.click(panel.getByRole('button', { name: 'Conjurar Curar Ferimentos' }));
    await userEvent.click(within(panel.getByRole('group', { name: 'Conjurar Curar Ferimentos' })).getByRole('button', { name: 'Conjurar Curar Ferimentos' }));
    await expect(args.spellcasting?.onCast).toHaveBeenLastCalledWith(2, 'Curar Ferimentos', { circle: 1 });
  },
};
