import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { CombatSessionEvent, RollSessionEvent, SessionEvent, SpellCastPayload, SpellCastSessionEvent, UnknownSessionEvent } from '@quest-fast/shared';
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

const castAt = (id: string, payload: Partial<SpellCastPayload>): SpellCastSessionEvent => ({
  id, campaignId: 'c1', userId: 'u2', userName: 'Rafael Costa', secret: false, createdAt: '2026-09-10T21:59:00.000Z', type: 'spell.cast',
  payload: { kind: 'spell.cast', characterId: 'lyra', characterName: 'Lyra Ventoclaro', spellName: 'Bênção', spellLevel: 1, circle: 2, concentration: true, ...payload },
});
const blessing = castAt('s1', {});
const ritualCast = castAt('s2', { spellName: 'Detectar Magia', circle: null });

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
/** The range as the row read when it was used. */
const thrown = attackEvent('a14', { ...sword, attackName: 'Machadinha', attackRange: '6/18 m', target: { ...goblinTarget, hit: true }, damage: slash });
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
/** The server rolled the goblin's save: the master reads the total. */
const breathRolled = attackEvent('a11', {
  ...sword,
  expression: '2d6',
  dice: [{ value: 3, sides: 6 }, { value: 4, sides: 6 }],
  modifier: 0,
  total: 7,
  attackName: 'Sopro de fogo',
  save: { dc: 13, ability: 'dexterity' },
  target: { ...goblinTarget, hit: true, save: { d20: 6, modifier: 2, total: 8, success: false } },
  damage: { expression: '2d6', dice: [{ value: 3, sides: 6 }, { value: 4, sides: 6 }], modifier: 0, total: 7, damageType: 'Fogo' },
});
/** What `redactEvent` leaves a player of a goblin's save: only passed or failed. */
const breathRolledForPlayer = attackEvent('a12', {
  ...sword,
  expression: '2d6',
  dice: [{ value: 3, sides: 6 }, { value: 4, sides: 6 }],
  modifier: 0,
  total: 7,
  attackName: 'Sopro de fogo',
  save: { dc: 13, ability: 'dexterity' },
  target: { ...goblinTarget, hit: true, save: { success: true } },
  damage: { expression: '2d6', dice: [{ value: 3, sides: 6 }, { value: 4, sides: 6 }], modifier: 0, total: 7, damageType: 'Fogo' },
});
/** An area: one damage roll, each target with its save and what it keeps. */
const fireball = attackEvent('a13', {
  ...sword,
  expression: '8d6',
  dice: [3, 5, 2, 6, 4, 1, 6, 3].map((value) => ({ value, sides: 6 })),
  modifier: 0,
  total: 30,
  attackName: 'Bola de Fogo',
  characterName: 'Lyra Ventoclaro',
  save: { dc: 15, ability: 'dexterity' },
  targets: [
    { ...goblinTarget, combatantId: 'g1', name: 'Goblin 1', hit: true, save: { success: false }, damage: 30 },
    { ...goblinTarget, combatantId: 'g2', name: 'Goblin 2', hit: true, save: { success: true }, damage: 15 },
    { combatantId: 'c-hazin', name: 'Hazin Dan', source: 'character', hit: true, save: { d20: 16, modifier: 1, total: 17, success: true }, damage: 15 },
  ],
  damage: { expression: '8d6', dice: [3, 5, 2, 6, 4, 1, 6, 3].map((value) => ({ value, sides: 6 })), modifier: 0, total: 30, damageType: 'Fogo' },
});
/** A save without damage (Graxa): nothing rolled, only the DC the target faces. */
const grease = attackEvent('a10', {
  ...sword,
  expression: '',
  dice: [],
  modifier: 0,
  total: 0,
  attackName: 'Graxa',
  save: { dc: 13, ability: 'dexterity' },
  target: { ...goblinTarget, hit: true },
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
export const AtaqueComAlcance: Story = { name: 'Ataque com alcance', args: { event: thrown }, play: reads('Alcance 6/18 m') };
export const AtaqueAcertoJogador: Story = { name: 'Ataque: acerto (jogador)', args: { event: hitForPlayer }, play: reads('Acertou') };
export const AtaqueErro: Story = { name: 'Ataque: erro', args: { event: miss }, play: reads('Errou (CA 15)') };
export const AtaqueCritico: Story = { name: 'Ataque: crítico', args: { event: critical }, play: reads('Crítico') };
export const AtaqueErroCritico: Story = { name: 'Ataque: 1 natural', args: { event: fumble }, play: reads('1 natural') };
export const AtaquePorSalvaguarda: Story = {
  name: 'Ataque por salvaguarda',
  args: { event: breath },
  play: reads('CD 13 de Destreza'),
};
export const SalvaguardaRolada: Story = {
  name: 'Salvaguarda rolada (mestre)',
  args: { event: breathRolled },
  play: reads('CD 13 de Destreza · Falhou (8)'),
};
export const SalvaguardaRoladaJogador: Story = {
  name: 'Salvaguarda rolada de monstro (jogador)',
  args: { event: breathRolledForPlayer },
  play: reads('CD 13 de Destreza · Passou'),
};
export const Area: Story = {
  name: 'Salvaguarda em área',
  args: { event: fireball },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const card = within(region!);
    await expect(card.getByText('Lyra Ventoclaro usou Bola de Fogo em Goblin 1, Goblin 2 e Hazin Dan')).toBeVisible();
    const targets = within(card.getByRole('list', { name: 'Alvos de Bola de Fogo' }));
    await expect(targets.getByText('Goblin 1: Falhou, 30 de dano')).toBeVisible();
    await expect(targets.getByText('Hazin Dan: Passou (17), 15 de dano')).toBeVisible();
  },
};
export const SalvaguardaSemDano: Story = {
  name: 'Salvaguarda sem dano',
  args: { event: grease },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const card = within(region!);
    await expect(card.getByText('CD 13 de Destreza, sem dano')).toBeVisible();
    await expect(card.queryByText(/Dano:/)).toBeNull();
  },
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
export const Conjuracao: Story = {
  name: 'Conjuração',
  args: { event: blessing },
  play: reads('Lyra Ventoclaro conjurou Bênção no 2º círculo. Concentrando-se.'),
};
export const ConjuracaoRitual: Story = {
  name: 'Conjuração como ritual',
  args: { event: ritualCast },
  play: reads('Lyra Ventoclaro conjurou Detectar Magia como ritual. Concentrando-se.'),
};
