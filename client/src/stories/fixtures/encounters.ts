import type { CombatantView, EncounterListItem, HealthBand } from '@quest-fast/shared';

/**
 * "Emboscada na estrada" as the server projects it. The master sees every
 * number and the hidden bandit; the player copy is what `projectEncounter`
 * hands Daniel (owner of Hazin Dan): monsters by health band only, no bandit.
 */

export const MASTER_ID = 'lia';
export const PLAYER_ID = 'daniel';

const base = {
  characterId: null,
  ownerId: null,
  size: 'small',
  hidden: false,
  hasInitiative: true,
  dexModifier: 2,
  tieOrder: 0,
  hpTemp: 0,
  defeated: false,
  conditions: [],
  concentrating: false,
} satisfies Partial<CombatantView>;

function monster(id: string, name: string, initiative: number | null, hpCurrent: number, hpMax: number, band: HealthBand, extra: Partial<CombatantView> = {}): CombatantView {
  return {
    ...base,
    id,
    source: 'statblock',
    name,
    initiative,
    hasInitiative: initiative !== null,
    ac: 15,
    hpMax,
    hpCurrent,
    healthBand: band,
    defeated: band === 'defeated',
    ...extra,
  };
}

const hazin: CombatantView = {
  ...base,
  id: 'c-hazin',
  source: 'character',
  characterId: 'hazin',
  ownerId: PLAYER_ID,
  name: 'Hazin Dan',
  size: 'medium',
  initiative: 15,
  dexModifier: 2,
  ac: 17,
  hpMax: 55,
  hpCurrent: 38,
  hpTemp: 5,
  healthBand: 'wounded',
};

const lyra: CombatantView = {
  ...base,
  id: 'c-lyra',
  source: 'character',
  characterId: 'lyra',
  ownerId: 'carla',
  name: 'Lyra Ventoclaro',
  size: 'medium',
  initiative: 10,
  dexModifier: 3,
  ac: 14,
  hpMax: 27,
  hpCurrent: 27,
  healthBand: 'unhurt',
  conditions: [{ condition: 'frightened', roundsLeft: 2 }],
  concentrating: true,
};

export const masterCombatants: CombatantView[] = [
  monster('g1', 'Goblin 1', 18, 7, 7, 'unhurt'),
  hazin,
  monster('bandit', 'Bandido', 12, 11, 11, 'unhurt', { source: 'manual', size: 'medium', hidden: true, ac: 12, dexModifier: 1 }),
  lyra,
  monster('g3', 'Goblin 3', 10, 0, 7, 'defeated', { tieOrder: 1, dexModifier: 3 }),
  monster('g2', 'Goblin 2', 10, 3, 7, 'bloodied', { conditions: [{ condition: 'prone' }] }),
  monster('g4', 'Goblin 4', 7, 5, 7, 'wounded'),
];

/** The player's copy: no hidden bandit and nothing of a monster but its band. */
export const playerCombatants: CombatantView[] = masterCombatants
  .filter((combatant) => !combatant.hidden)
  .map((combatant) =>
    combatant.source === 'character'
      ? { ...combatant, dexModifier: null, tieOrder: null }
      : { ...combatant, initiative: null, ac: null, hpMax: null, hpCurrent: null, hpTemp: null, dexModifier: null, tieOrder: null },
  );

/** Round 0: the goblins rolled, the characters still have to. */
export const awaitingInitiative: CombatantView[] = [
  monster('g1', 'Goblin 1', 18, 7, 7, 'unhurt'),
  monster('g2', 'Goblin 2', 9, 7, 7, 'unhurt'),
  { ...hazin, initiative: null, hasInitiative: false },
  { ...lyra, initiative: null, hasInitiative: false, conditions: [] },
];

/** Two goblins tied on 12 with the same Dexterity: the master's order decides. */
export const tiedCombatants: CombatantView[] = [
  monster('t1', 'Goblin Arqueiro', 12, 7, 7, 'unhurt'),
  monster('t2', 'Goblin Batedor', 12, 7, 7, 'unhurt', { tieOrder: 1 }),
  { ...hazin, initiative: 12, dexModifier: 0 },
];

export const encounterList: EncounterListItem[] = [
  { id: 'e-active', name: 'Emboscada na estrada', status: 'active', round: 3, createdAt: '2026-10-22T20:00:00.000Z', endedAt: null, combatantCount: 7 },
  { id: 'e-prep', name: 'Covil do Cragmaw', status: 'preparing', round: 0, createdAt: '2026-10-21T20:00:00.000Z', endedAt: null, combatantCount: 12 },
  {
    id: 'e-ended',
    name: 'Ponte sobre o Rio Triboar, onde os bandidos cobravam pedágio dos viajantes de Phandalin',
    status: 'ended',
    round: 1,
    createdAt: '2026-10-15T20:00:00.000Z',
    endedAt: '2026-10-15T21:10:00.000Z',
    combatantCount: 1,
  },
];
