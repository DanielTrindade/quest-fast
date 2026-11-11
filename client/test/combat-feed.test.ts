import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatConditionPayload, CombatDeathSavePayload, CombatHitPointsPayload } from '@quest-fast/shared';
import { combatEventText } from '../src/lib/combat-feed.ts';

const goblin = { encounterId: 'e1', combatantId: 'g2', name: 'Goblin 2', source: 'statblock' } as const;
const kaelen = { encounterId: 'e1', combatantId: 'k1', name: 'Kaelen', source: 'character' } as const;

function hp(payload: Partial<CombatHitPointsPayload> & Pick<CombatHitPointsPayload, 'kind' | 'band'>): CombatHitPointsPayload {
  return { ...goblin, ...payload };
}

test("the master reads a monster's damage, healing and defeat in numbers", () => {
  assert.equal(combatEventText(hp({ kind: 'combat.damage', amount: 4, hpCurrent: 3, hpMax: 7, band: 'bloodied' })), 'Goblin 2 sofreu 4 de dano (3/7).');
  assert.equal(combatEventText(hp({ kind: 'combat.heal', amount: 2, hpCurrent: 5, hpMax: 7, band: 'wounded' })), 'Goblin 2 recuperou 2 PV (5/7).');
  assert.equal(combatEventText(hp({ kind: 'combat.defeated', amount: 30, hpCurrent: 0, hpMax: 7, band: 'defeated' })), 'Goblin 2 sofreu 30 de dano e foi derrotado.');
});

test('a player reads the same events as a band, without numbers', () => {
  assert.equal(combatEventText(hp({ kind: 'combat.damage', band: 'bloodied' })), 'Goblin 2 está muito ferido.');
  assert.equal(combatEventText(hp({ kind: 'combat.damage', band: 'wounded' })), 'Goblin 2 está ferido.');
  assert.equal(combatEventText(hp({ kind: 'combat.heal', band: 'unhurt' })), 'Goblin 2 está ileso.');
  assert.equal(combatEventText(hp({ kind: 'combat.defeated', band: 'defeated' })), 'Goblin 2 foi derrotado.');
});

test('a character who goes down is said to fall', () => {
  assert.equal(
    combatEventText({ ...kaelen, kind: 'combat.damage', amount: 30, hpCurrent: 0, hpMax: 24, band: 'defeated' }),
    'Kaelen sofreu 30 de dano e caiu (0/24).',
  );
});

test('conditions applied, removed and run out read differently', () => {
  const poisoned = { condition: 'poisoned', roundsLeft: 2 } as const;
  const condition = (action: CombatConditionPayload['action']): CombatConditionPayload => ({ ...kaelen, kind: 'combat.condition', action, condition: poisoned });
  assert.equal(combatEventText(condition('applied')), 'Kaelen está com a condição Envenenado (2 rodadas).');
  assert.equal(combatEventText(condition('removed')), 'Kaelen não está mais com a condição Envenenado.');
  assert.equal(combatEventText(condition('expired')), 'A condição Envenenado de Kaelen acabou.');
});

test('a death save tells the face, the result and the count', () => {
  const save = (payload: Partial<CombatDeathSavePayload>): CombatDeathSavePayload => ({
    ...kaelen,
    kind: 'combat.deathSave',
    saves: { successes: 1, failures: 0 },
    outcome: 'pending',
    ...payload,
  });
  assert.equal(combatEventText(save({ d20: 14 })), 'Kaelen tirou 14 no teste contra a morte: sucesso (1 sucesso, 0 falhas).');
  assert.equal(combatEventText(save({ d20: 1, saves: { successes: 1, failures: 2 } })), 'Kaelen tirou 1 no teste contra a morte: duas falhas (1 sucesso, 2 falhas).');
  assert.equal(combatEventText(save({ d20: 12, saves: { successes: 3, failures: 1 }, outcome: 'stable' })), 'Kaelen tirou 12 no teste contra a morte: sucesso. Está estável.');
  assert.equal(combatEventText(save({ d20: 4, saves: { successes: 0, failures: 3 }, outcome: 'dead' })), 'Kaelen tirou 4 no teste contra a morte: falha. Morreu.');
  assert.equal(combatEventText(save({ d20: 20, saves: { successes: 0, failures: 0 }, outcome: 'revived' })), 'Kaelen tirou 20 no teste contra a morte e voltou com 1 PV.');
  assert.equal(
    combatEventText(save({ failures: 2, saves: { successes: 0, failures: 2 } })),
    'Kaelen sofreu dano caído: duas falhas no teste contra a morte (0 sucessos, 2 falhas).',
  );
});
