import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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

function Frame({ event, onRollDamage }: { event: SessionEvent; onRollDamage?: (eventId: string) => void }) {
  return (
    <ol className="m-0 list-none p-0 [&>li]:py-3 [&>li+li]:border-t [&>li+li]:border-border" style={{ maxWidth: 420 }}>
      <li><FeedEventCard event={event} onRollDamage={onRollDamage} /></li>
    </ol>
  );
}

// --- Attacks during a fight ---------------------------------------------------

const sword = {
  kind: 'roll',
  expression: '1d20+5',
  dice: [{ value: 12, sides: 20 }],
  modifier: 5,
  total: 17,
  mode: 'normal',
  rollKind: 'attack',
  attackName: 'Espada longa',
  characterId: 'kaelen',
  characterName: 'Kaelen',
  attackerSource: 'character',
} satisfies RollSessionEvent['payload'];
const goblinTarget = { combatantId: 'g2', name: 'Goblin 2', source: 'monster' } as const;
const slash = { expression: '1d8+3', dice: [{ value: 6, sides: 8 }], modifier: 3, total: 9, damageType: 'Cortante' };

function attackEvent(id: string, payload: RollSessionEvent['payload'], extra: Partial<RollSessionEvent> = {}): RollSessionEvent {
  return { ...roll, id, payload, createdAt: '2026-09-10T21:58:00.000Z', ...extra };
}

const hitForMaster = attackEvent('a1', { ...sword, target: { ...goblinTarget, hit: true, ac: 15 }, damage: slash });
/** The same hit as a player reads it: no monster AC. */
const hitForPlayer = attackEvent('a2', { ...sword, target: { ...goblinTarget, hit: true }, damage: slash });
const miss = attackEvent('a3', { ...sword, dice: [{ value: 4, sides: 20 }], total: 9, target: { ...goblinTarget, hit: false, ac: 15 } });
const critical = attackEvent('a4', {
  ...sword,
  dice: [{ value: 20, sides: 20 }],
  total: 25,
  natural: 20,
  critical: true,
  target: { ...goblinTarget, hit: true, ac: 15 },
  damage: { ...slash, expression: '2d8+3', dice: [{ value: 6, sides: 8 }, { value: 7, sides: 8 }], total: 16 },
});
const fumble = attackEvent('a5', { ...sword, dice: [{ value: 1, sides: 20 }], total: 6, natural: 1, target: { ...goblinTarget, hit: false, ac: 15 } });
const breath = attackEvent('a6', {
  ...sword,
  expression: '2d6',
  dice: [{ value: 3, sides: 6 }, { value: 4, sides: 6 }],
  modifier: 0,
  total: 7,
  attackName: 'Sopro de fogo',
  save: { dc: 13, ability: 'dexterity' },
  target: { ...goblinTarget, hit: true },
  damage: { expression: '2d6', dice: [{ value: 3, sides: 6 }, { value: 4, sides: 6 }], modifier: 0, total: 7, damageType: 'Fogo' },
});
/** What `redactEvent` leaves a player of a public goblin attack: hit, critical and damage. */
const monsterForPlayer = attackEvent(
  'a7',
  {
    ...sword,
    expression: '',
    dice: [],
    modifier: 0,
    total: 0,
    attackName: 'Cimitarra',
    characterId: undefined,
    characterName: 'Goblin 1',
    attackerSource: 'monster',
    critical: true,
    target: { combatantId: 'c-hazin', name: 'Hazin Dan', source: 'character', hit: true, ac: 17 },
    damage: { expression: '', dice: [], modifier: 0, total: 14, damageType: 'Cortante' },
    redacted: true,
  },
  { userId: 'lia', userName: 'Lia Martins' },
);
const untargeted = attackEvent('a8', { ...sword, damageRollable: { expression: '1d8+3', damageType: 'Cortante' } });
const damageLater = attackEvent('a9', { ...sword, ...slash, damageOf: 'a8', damage: slash });

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
export const AtaqueAcerto: Story = {
  name: 'Ataque: acerto (mestre)',
  args: { event: hitForMaster },
  play: reads('Acertou (CA 15)'),
};
export const AtaqueAcertoJogador: Story = { name: 'Ataque: acerto (jogador)', args: { event: hitForPlayer }, play: reads('Acertou') };
export const AtaqueErro: Story = { name: 'Ataque: erro', args: { event: miss }, play: reads('Errou (CA 15)') };
export const AtaqueCritico: Story = { name: 'Ataque: crítico', args: { event: critical }, play: reads('Crítico') };
export const AtaqueErroCritico: Story = { name: 'Ataque: 1 natural', args: { event: fumble }, play: reads('1 natural') };
export const AtaquePorSalvaguarda: Story = {
  name: 'Ataque por salvaguarda',
  args: { event: breath },
  play: reads('CD 13 de Destreza'),
};
export const AtaqueDeMonstroJogador: Story = {
  name: 'Ataque de monstro (jogador)',
  args: { event: monsterForPlayer },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const card = within(region!);
    await expect(card.getByText('Goblin 1 atacou Hazin Dan com Cimitarra')).toBeVisible();
    // No d20 to read the bonus from: only what the master says at the table.
    await expect(card.queryByRole('group', { name: /Cimitarra/ })).toBeNull();
    await expect(card.getByText('14 cortante')).toBeVisible();
  },
};
export const AtaqueSemAlvo: Story = {
  name: 'Ataque sem alvo, com dano a rolar',
  args: { event: untargeted, onRollDamage: fn() },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await userEvent.click(within(region!).getByRole('button', { name: 'Rolar dano de Espada longa' }));
    await expect(args.onRollDamage).toHaveBeenCalledWith('a8');
  },
};
export const DanoDepois: Story = { name: 'Dano rolado depois', args: { event: damageLater }, play: reads('Dano de Kaelen com Espada longa') };
