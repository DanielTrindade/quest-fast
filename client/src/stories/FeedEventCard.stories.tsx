import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { CombatSessionEvent, RollSessionEvent, SessionEvent, UnknownSessionEvent } from '@quest-fast/shared';
import { FeedEventCard } from '../components/FeedEventCard';

const roll: RollSessionEvent = {
  id: 'e1',
  campaignId: 'phandalin',
  userId: 'rafael',
  userName: 'Rafael Costa',
  type: 'roll',
  secret: false,
  payload: {
    kind: 'roll',
    expression: '1d20+6',
    dice: [{ value: 14, sides: 20 }],
    modifier: 6,
    total: 20,
    mode: 'normal',
    rollKind: 'skill',
    characterId: 'kaelen',
    characterName: 'Kaelen',
    ability: 'dexterity',
    skill: 'stealth',
  },
  createdAt: '2026-09-10T21:47:00.000Z',
};

const attack: RollSessionEvent = {
  ...roll,
  id: 'e2',
  payload: {
    ...roll.payload,
    rollKind: 'attack',
    attackName: 'Adaga',
    skill: undefined,
    expression: '1d20+7',
    modifier: 7,
    total: 21,
    dice: [{ value: 14, sides: 20 }],
  },
  createdAt: '2026-09-10T21:48:00.000Z',
};

const secret: RollSessionEvent = { ...roll, id: 'e3', secret: true, createdAt: '2026-09-10T21:49:00.000Z' };

const unknown: UnknownSessionEvent = {
  id: 'e4',
  campaignId: 'phandalin',
  userId: 'lia',
  userName: 'Lia Martins',
  type: 'token.moved',
  secret: false,
  payload: { tokenId: 't1' },
  createdAt: '2026-09-10T21:50:00.000Z',
};

const combatStarted: CombatSessionEvent = {
  id: 'e5',
  campaignId: 'phandalin',
  userId: 'lia',
  userName: 'Lia Martins',
  type: 'combat.started',
  secret: false,
  payload: { kind: 'combat.started', encounterId: 'emboscada', encounterName: 'Emboscada na estrada' },
  createdAt: '2026-09-10T21:51:00.000Z',
};

const combatEnded: CombatSessionEvent = {
  ...combatStarted,
  id: 'e6',
  type: 'combat.ended',
  payload: {
    kind: 'combat.ended',
    encounterId: 'emboscada',
    encounterName: 'Emboscada na estrada',
    rounds: 4,
    defeated: [{ name: 'Goblin 1', hidden: false }, { name: 'Goblin 3', hidden: false }],
  },
  createdAt: '2026-09-10T22:20:00.000Z',
};

const goblin = { encounterId: 'emboscada', combatantId: 'g2', name: 'Goblin 2', source: 'statblock' } as const;
const hazin = { encounterId: 'emboscada', combatantId: 'c-hazin', name: 'Hazin Dan', source: 'character' } as const;

function fightEvent(id: string, event: Pick<CombatSessionEvent, 'type' | 'payload'>, secret = false): CombatSessionEvent {
  return { ...combatStarted, id, secret, createdAt: '2026-09-10T21:55:00.000Z', ...event } as CombatSessionEvent;
}

const damageForMaster = fightEvent('f1', {
  type: 'combat.damage',
  payload: { ...goblin, kind: 'combat.damage', amount: 4, hpCurrent: 3, hpMax: 7, band: 'bloodied' },
});
/** What `redactEvent` leaves of the same event for a player: the band only. */
const damageForPlayer = fightEvent('f2', { type: 'combat.damage', payload: { ...goblin, kind: 'combat.damage', band: 'bloodied' } });
const defeated = fightEvent('f3', { type: 'combat.defeated', payload: { ...goblin, kind: 'combat.defeated', band: 'defeated' } });
const heal = fightEvent('f4', {
  type: 'combat.heal',
  payload: { ...hazin, kind: 'combat.heal', amount: 8, hpCurrent: 46, hpMax: 55, band: 'wounded' },
});
const conditionApplied = fightEvent('f5', {
  type: 'combat.condition',
  payload: { ...hazin, kind: 'combat.condition', action: 'applied', condition: { condition: 'poisoned', roundsLeft: 2 } },
});
const conditionExpired = fightEvent('f6', {
  type: 'combat.condition',
  payload: { ...goblin, kind: 'combat.condition', action: 'expired', condition: { condition: 'prone', roundsLeft: 1 } },
});
const deathSave = fightEvent('f7', {
  type: 'combat.deathSave',
  payload: { ...hazin, kind: 'combat.deathSave', d20: 14, saves: { successes: 2, failures: 1 }, outcome: 'pending' },
});
const deathFailures = fightEvent('f8', {
  type: 'combat.deathSave',
  payload: { ...hazin, kind: 'combat.deathSave', failures: 2, saves: { successes: 1, failures: 3 }, outcome: 'dead' },
});
const hiddenDamage = fightEvent(
  'f9',
  { type: 'combat.damage', payload: { ...goblin, name: 'Bandido', source: 'manual', kind: 'combat.damage', amount: 2, hpCurrent: 9, hpMax: 11, band: 'wounded' } },
  true,
);
const concentrationSave: RollSessionEvent = {
  ...roll,
  id: 'f10',
  payload: { ...roll.payload, rollKind: 'save', ability: 'constitution', skill: undefined, characterName: 'Lyra Ventoclaro', concentrationDc: 12 },
};

/** Checks the sentence the first theme frame shows. */
function reads(text: string): Story['play'] {
  return async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText(text)).toBeVisible();
  };
}

function Frame({ event }: { event: SessionEvent }) {
  return (
    <ol className="m-0 list-none p-0 [&>li]:py-3 [&>li+li]:border-t [&>li+li]:border-border" style={{ maxWidth: 420 }}>
      <li><FeedEventCard event={event} /></li>
    </ol>
  );
}

const meta = { title: 'Componentes/FeedEventCard', component: Frame, args: { event: roll } } satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pericia: Story = { name: 'Perícia' };
export const Ataque: Story = { args: { event: attack } };
export const Secreta: Story = { args: { event: secret } };
export const CombateIniciado: Story = { name: 'Combate iniciado', args: { event: combatStarted } };
export const CombateEncerrado: Story = { name: 'Combate encerrado', args: { event: combatEnded } };
export const TipoDesconhecido: Story = { name: 'Tipo desconhecido (Fase 2)', args: { event: unknown } };

export const DanoMestre: Story = { name: 'Dano em monstro (mestre)', args: { event: damageForMaster }, play: reads('Goblin 2 sofreu 4 de dano (3/7).') };
export const DanoJogador: Story = { name: 'Dano em monstro (jogador)', args: { event: damageForPlayer }, play: reads('Goblin 2 está muito ferido.') };
export const Derrotado: Story = { args: { event: defeated }, play: reads('Goblin 2 foi derrotado.') };
export const Cura: Story = { args: { event: heal }, play: reads('Hazin Dan recuperou 8 PV (46/55).') };
export const CondicaoAplicada: Story = { name: 'Condição aplicada', args: { event: conditionApplied } };
export const CondicaoExpirada: Story = { name: 'Condição expirada', args: { event: conditionExpired }, play: reads('A condição Caído de Goblin 2 acabou.') };
export const TesteContraAMorte: Story = { name: 'Teste contra a morte', args: { event: deathSave } };
export const FalhasPorDano: Story = { name: 'Falhas por dano caído', args: { event: deathFailures } };
/** A hidden combatant's events are the master's secret, even after it is revealed. */
export const DanoEscondido: Story = { name: 'Dano em escondido (secreto)', args: { event: hiddenDamage } };
export const SalvaguardaDeConcentracao: Story = { name: 'Salvaguarda de concentração', args: { event: concentrationSave } };