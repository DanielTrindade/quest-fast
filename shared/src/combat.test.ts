import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_LIMITS,
  CONDITIONS,
  STATBLOCK_LIMITS,
  applyHpChange,
  changedCharacters,
  concentrationDc,
  copyNumber,
  damageReminders,
  deathSaveFailure,
  deathSaveOutcome,
  deathSaveStatus,
  hasPreviousTurn,
  healthBand,
  isActiveCondition,
  isCondition,
  isDefeated,
  nextTurn,
  numberCopies,
  pendingReminders,
  placeCopies,
  previousTurn,
  removeCondition,
  setCondition,
  sortInitiative,
  tickConditions,
  turnQueue,
  type ActiveCondition,
  type CharacterVitals,
  type CombatReminder,
} from './combat.ts';

test('damage goes through temporary hit points and reports a fall to 0', () => {
  const standing = { hpCurrent: 5, hpTemp: 2 };
  assert.deepEqual(applyHpChange(standing, 'damage', 3, 10), { hitPoints: { hpCurrent: 4, hpTemp: 0 }, fell: false, rose: false });
  assert.deepEqual(applyHpChange(standing, 'damage', 7, 10), { hitPoints: { hpCurrent: 0, hpTemp: 0 }, fell: true, rose: false });
});

test('damage on someone already at 0 is no new fall', () => {
  assert.equal(applyHpChange({ hpCurrent: 0, hpTemp: 0 }, 'damage', 4, 10).fell, false);
});

test('healing stops at the maximum and reports coming back from 0', () => {
  assert.deepEqual(applyHpChange({ hpCurrent: 0, hpTemp: 1 }, 'heal', 4, 10), { hitPoints: { hpCurrent: 4, hpTemp: 1 }, fell: false, rose: true });
  assert.deepEqual(applyHpChange({ hpCurrent: 9, hpTemp: 0 }, 'heal', 4, 10), { hitPoints: { hpCurrent: 10, hpTemp: 0 }, fell: false, rose: false });
});

test('temporary hit points keep the highest value and do not stack', () => {
  assert.equal(applyHpChange({ hpCurrent: 5, hpTemp: 3 }, 'temp', 5, 10).hitPoints.hpTemp, 5);
  assert.equal(applyHpChange({ hpCurrent: 5, hpTemp: 8 }, 'temp', 5, 10).hitPoints.hpTemp, 8);
});

test('damage to someone concentrating asks for a save with the DC of that damage', () => {
  const base = { hpCurrentBefore: 20, concentrating: true, source: 'character' as const };
  assert.deepEqual(damageReminders({ ...base, amount: 8 }), [{ kind: 'concentration', dc: 10 }]);
  assert.deepEqual(damageReminders({ ...base, amount: 40 }), [{ kind: 'concentration', dc: 20 }]);
  assert.deepEqual(damageReminders({ ...base, concentrating: false, amount: 8 }), []);
});

test('a monster also has to keep its concentration', () => {
  assert.deepEqual(damageReminders({ amount: 12, hpCurrentBefore: 30, concentrating: true, source: 'statblock' }), [{ kind: 'concentration', dc: 10 }]);
});

test('damage to a character already down asks for a death save failure, and only to a character', () => {
  assert.deepEqual(damageReminders({ amount: 3, hpCurrentBefore: 0, concentrating: false, source: 'character' }), [{ kind: 'deathFailure' }]);
  assert.deepEqual(damageReminders({ amount: 3, hpCurrentBefore: 0, concentrating: false, source: 'manual' }), []);
  // The hit that takes a character down is not a failure yet.
  assert.deepEqual(damageReminders({ amount: 30, hpCurrentBefore: 5, concentrating: false, source: 'character' }), []);
});

test('no damage leaves no reminder', () => {
  assert.deepEqual(damageReminders({ amount: 0, hpCurrentBefore: 0, concentrating: true, source: 'character' }), []);
});

test('a reminder that lost its meaning is no longer pending', () => {
  const reminders: CombatReminder[] = [
    { id: 'c', kind: 'concentration', dc: 12 },
    { id: 'd', kind: 'deathFailure' },
  ];
  assert.deepEqual(pendingReminders(reminders, { hpCurrent: 0, concentrating: true }), reminders);
  assert.deepEqual(pendingReminders(reminders, { hpCurrent: 5, concentrating: true }), [reminders[0]]);
  assert.deepEqual(pendingReminders(reminders, { hpCurrent: 0, concentrating: false }), [reminders[1]]);
  assert.deepEqual(pendingReminders(reminders, { hpCurrent: 5, concentrating: false }), []);
});

test('a death save failure adds up and keeps the successes while still dying', () => {
  assert.deepEqual(deathSaveFailure({ successes: 1, failures: 0 }, 1), { successes: 1, failures: 1 });
  assert.deepEqual(deathSaveFailure({ successes: 1, failures: 1 }, 2), { successes: 1, failures: 3 });
  assert.deepEqual(deathSaveFailure({ successes: 0, failures: 2 }, 2), { successes: 0, failures: 3 });
});

test('damage to a stable character starts the death saves over', () => {
  assert.deepEqual(deathSaveFailure({ successes: 3, failures: 2 }, 1), { successes: 0, failures: 1 });
});

test('the death saves tell whether the character is dying, stable or dead', () => {
  assert.equal(deathSaveStatus({ successes: 2, failures: 2 }), 'pending');
  assert.equal(deathSaveStatus({ successes: 3, failures: 1 }), 'stable');
  assert.equal(deathSaveStatus({ successes: 1, failures: 3 }), 'dead');
});

test('a condition appears once: applying it again updates level and duration', () => {
  const first = setCondition([], { condition: 'exhaustion', level: 1 });
  assert.deepEqual(first, [{ condition: 'exhaustion', level: 1 }]);
  const poisoned = setCondition(first, { condition: 'poisoned', roundsLeft: 2 });
  assert.deepEqual(setCondition(poisoned, { condition: 'exhaustion', level: 2 }), [
    { condition: 'exhaustion', level: 2 },
    { condition: 'poisoned', roundsLeft: 2 },
  ]);
});

test('removing a condition keeps the others, and a missing one changes nothing', () => {
  const conditions: ActiveCondition[] = [{ condition: 'prone' }, { condition: 'poisoned' }];
  assert.deepEqual(removeCondition(conditions, 'prone'), [{ condition: 'poisoned' }]);
  assert.deepEqual(removeCondition(conditions, 'stunned'), conditions);
});

test('a duration has a ceiling', () => {
  const { max } = COMBAT_LIMITS.conditionRounds;
  assert.equal(isActiveCondition({ condition: 'prone', roundsLeft: max }), true);
  assert.equal(isActiveCondition({ condition: 'prone', roundsLeft: max + 1 }), false);
});

function vitals(characterId: string | null, changes: Partial<CharacterVitals> = {}): CharacterVitals {
  return {
    characterId,
    hpCurrent: 10,
    hpTemp: 0,
    conditions: [],
    concentrating: false,
    deathSaves: { successes: 0, failures: 0 },
    ...changes,
  };
}

test('only the characters whose sheet changed are reported', () => {
  const before = [vitals('a'), vitals('b'), vitals(null)];
  assert.deepEqual(changedCharacters(before, before), []);
  assert.deepEqual(changedCharacters(before, [vitals('a', { hpCurrent: 3 }), vitals('b'), vitals(null, { hpCurrent: 1 })]), ['a']);
});

test('each part of the sheet that combat shows counts as a change', () => {
  const before = [vitals('a')];
  for (const changes of [
    { hpTemp: 2 },
    { conditions: [{ condition: 'prone' as const }] },
    { concentrating: true },
    { deathSaves: { successes: 1, failures: 0 } },
  ]) {
    assert.deepEqual(changedCharacters(before, [vitals('a', changes)]), ['a']);
  }
});

test('with nothing known yet, every character may have changed', () => {
  assert.deepEqual(changedCharacters(undefined, [vitals('a'), vitals(null), vitals('b')]), ['a', 'b']);
  assert.deepEqual(changedCharacters([], [vitals('a')]), ['a']);
});

test('the fifteen 2024 conditions are recognized', () => {
  assert.equal(CONDITIONS.length, 15);
  for (const condition of CONDITIONS) assert.ok(isCondition(condition));
  assert.equal(isCondition('bloodied'), false);
  assert.equal(isCondition(3), false);
});

test('an active condition accepts an optional duration', () => {
  assert.ok(isActiveCondition({ condition: 'prone' }));
  assert.ok(isActiveCondition({ condition: 'frightened', roundsLeft: 10 }));
  assert.equal(isActiveCondition({ condition: 'frightened', roundsLeft: 0 }), false);
  assert.equal(isActiveCondition({ condition: 'frightened', roundsLeft: -1 }), false);
  assert.equal(isActiveCondition({ condition: 'frightened', roundsLeft: 1.5 }), false);
  assert.equal(isActiveCondition({ condition: 'unknown' }), false);
  assert.equal(isActiveCondition(null), false);
});

test('only exhaustion carries a level, from 1 to 6', () => {
  assert.ok(isActiveCondition({ condition: 'exhaustion', level: 1 }));
  assert.ok(isActiveCondition({ condition: 'exhaustion', level: 6 }));
  assert.equal(isActiveCondition({ condition: 'exhaustion' }), false);
  assert.equal(isActiveCondition({ condition: 'exhaustion', level: 0 }), false);
  assert.equal(isActiveCondition({ condition: 'exhaustion', level: 7 }), false);
  assert.equal(isActiveCondition({ condition: 'prone', level: 1 }), false);
});

test('ticking shortens durations and separates the expired ones', () => {
  const conditions: ActiveCondition[] = [
    { condition: 'prone' },
    { condition: 'frightened', roundsLeft: 1 },
    { condition: 'poisoned', roundsLeft: 3 },
    { condition: 'exhaustion', level: 2 },
  ];
  const { remaining, expired } = tickConditions(conditions);
  assert.deepEqual(remaining, [
    { condition: 'prone' },
    { condition: 'poisoned', roundsLeft: 2 },
    { condition: 'exhaustion', level: 2 },
  ]);
  assert.deepEqual(expired, [{ condition: 'frightened', roundsLeft: 1 }]);
  assert.equal(conditions[2].roundsLeft, 3, 'the input is not mutated');
});

test('ticking an empty list is a no-op', () => {
  assert.deepEqual(tickConditions([]), { remaining: [], expired: [] });
});

const queue = (...ids: string[]) => ids.map((id) => ({ id, defeated: false }));

test('initiative orders by value, then Dexterity, then the master tie order', () => {
  const sorted = sortInitiative([
    { id: 'goblin', initiative: 12, dexModifier: 2, tieOrder: 0 },
    { id: 'kaelen', initiative: 18, dexModifier: 4, tieOrder: 0 },
    { id: 'hazin', initiative: 12, dexModifier: 2, tieOrder: 1 },
    { id: 'wolf', initiative: 12, dexModifier: 3, tieOrder: 5 },
    { id: 'late', initiative: null, dexModifier: 9, tieOrder: 0 },
  ]);
  assert.deepEqual(sorted.map((c) => c.id), ['kaelen', 'wolf', 'goblin', 'hazin']);
});

test('sorting does not mutate the input', () => {
  const input = [
    { id: 'a', initiative: 1, dexModifier: 0, tieOrder: 0 },
    { id: 'b', initiative: 9, dexModifier: 0, tieOrder: 0 },
  ];
  sortInitiative(input);
  assert.deepEqual(input.map((c) => c.id), ['a', 'b']);
});

test('the next turn moves along the queue and wraps into a new round', () => {
  const order = queue('a', 'b', 'c');
  assert.deepEqual(nextTurn(order, 'a', 1), { activeId: 'b', round: 1 });
  assert.deepEqual(nextTurn(order, 'c', 1), { activeId: 'a', round: 2 });
});

test('the next turn skips defeated combatants, also across rounds', () => {
  const order = [
    { id: 'a', defeated: true },
    { id: 'b', defeated: false },
    { id: 'c', defeated: true },
  ];
  assert.deepEqual(nextTurn(order, 'b', 3), { activeId: 'b', round: 4 });
});

test('without an active combatant, the turn goes to the first one standing', () => {
  const order = [{ id: 'a', defeated: true }, ...queue('b', 'c')];
  assert.deepEqual(nextTurn(order, null, 1), { activeId: 'b', round: 1 });
  assert.deepEqual(nextTurn(order, 'gone', 2), { activeId: 'b', round: 2 });
});

test('with everyone defeated or nobody in the queue, the turn stays put', () => {
  const order = [{ id: 'a', defeated: true }, { id: 'b', defeated: true }];
  assert.deepEqual(nextTurn(order, 'a', 2), { activeId: 'a', round: 2 });
  assert.deepEqual(nextTurn([], null, 1), { activeId: null, round: 1 });
});

test('the previous turn steps back and unwinds the round', () => {
  const order = queue('a', 'b', 'c');
  assert.deepEqual(previousTurn(order, 'b', 1), { activeId: 'a', round: 1 });
  assert.deepEqual(previousTurn(order, 'a', 3), { activeId: 'c', round: 2 });
  const withDefeated = [...queue('a', 'b'), { id: 'c', defeated: true }];
  assert.deepEqual(previousTurn(withDefeated, 'a', 2), { activeId: 'b', round: 1 });
});

test('going back from the very first turn of the combat is a no-op', () => {
  assert.deepEqual(previousTurn(queue('a', 'b'), 'a', 1), { activeId: 'a', round: 1 });
});

test('there is a previous turn anywhere but the first turn standing of round 1', () => {
  assert.equal(hasPreviousTurn(queue('a', 'b'), 'a', 1), false);
  assert.equal(hasPreviousTurn([{ id: 'a', defeated: true }, ...queue('b', 'c')], 'b', 1), false);
  assert.equal(hasPreviousTurn(queue('a', 'b'), 'b', 1), true);
  assert.equal(hasPreviousTurn(queue('a', 'b'), 'a', 2), true);
  // Alone and standing, going back still unwinds the round.
  assert.equal(hasPreviousTurn(queue('a'), 'a', 2), true);
});

test('the health band hides hit points behind four steps', () => {
  assert.equal(healthBand(10, 10), 'unhurt');
  assert.equal(healthBand(9, 10), 'wounded');
  assert.equal(healthBand(6, 10), 'wounded');
  assert.equal(healthBand(5, 10), 'bloodied');
  assert.equal(healthBand(1, 10), 'bloodied');
  assert.equal(healthBand(0, 10), 'defeated');
  assert.equal(healthBand(6, 11), 'wounded');
  assert.equal(healthBand(5, 11), 'bloodied');
  assert.equal(healthBand(0, 0), 'defeated');
});

test('the concentration DC is half the damage, between 10 and 30', () => {
  assert.equal(concentrationDc(0), 10);
  assert.equal(concentrationDc(1), 10);
  assert.equal(concentrationDc(21), 10);
  assert.equal(concentrationDc(22), 11);
  assert.equal(concentrationDc(60), 30);
  assert.equal(concentrationDc(100), 30);
});

test('a death save succeeds on 10 or more and fails below', () => {
  assert.deepEqual(deathSaveOutcome(10, { successes: 0, failures: 0 }), {
    saves: { successes: 1, failures: 0 },
    status: 'pending',
  });
  assert.deepEqual(deathSaveOutcome(9, { successes: 1, failures: 0 }), {
    saves: { successes: 1, failures: 1 },
    status: 'pending',
  });
});

test('a natural 1 counts as two failures and a natural 20 revives with 1 hit point', () => {
  assert.deepEqual(deathSaveOutcome(1, { successes: 0, failures: 0 }).saves, { successes: 0, failures: 2 });
  assert.deepEqual(deathSaveOutcome(20, { successes: 1, failures: 2 }), {
    saves: { successes: 0, failures: 0 },
    status: 'revived',
    hpCurrent: 1,
  });
});

test('three successes stabilize and three failures kill, never counting past 3', () => {
  assert.equal(deathSaveOutcome(15, { successes: 2, failures: 2 }).status, 'stable');
  assert.equal(deathSaveOutcome(5, { successes: 2, failures: 2 }).status, 'dead');
  assert.deepEqual(deathSaveOutcome(1, { successes: 0, failures: 2 }), {
    saves: { successes: 0, failures: 3 },
    status: 'dead',
  });
});

test('copies of a creature are numbered, continuing what is already there', () => {
  assert.deepEqual(numberCopies('Goblin', 3, []), ['Goblin 1', 'Goblin 2', 'Goblin 3']);
  assert.deepEqual(numberCopies('Goblin', 1, []), ['Goblin']);
  assert.deepEqual(numberCopies('Goblin', 2, ['Goblin 2', 'Lobo 7']), ['Goblin 3', 'Goblin 4']);
  assert.deepEqual(numberCopies('Goblin', 1, ['Goblin']), ['Goblin 2']);
  assert.deepEqual(numberCopies('Goblin', 1, ['Goblin Chefe']), ['Goblin']);
  assert.deepEqual(numberCopies('Goblin', 0, []), []);

  const long = 'Guardião Esquecido das Catacumbas Submersas de Vel’Tharon, Senhor das Marés Fria';
  assert.equal(long.length, STATBLOCK_LIMITS.name);
  const [eleventh, twelfth] = numberCopies(long, 2, [`${long.slice(0, 77)} 10`]);
  assert.equal(eleventh, `${long.slice(0, 77)} 11`);
  assert.ok(twelfth!.length <= STATBLOCK_LIMITS.name);
  assert.equal(copyNumber(twelfth!, long), 12);

  // Copies stored with the whole name, before the cut, still count.
  const legacy = [`${long} 1`, `${long} 2`];
  assert.equal(copyNumber(legacy[1]!, long), 2);
  assert.deepEqual(numberCopies(long, 1, legacy), [`${long.slice(0, 78)} 3`]);
  assert.equal(copyNumber(`${long.slice(0, 70)} 4`, long), null);
  const revealed = placeCopies(long, 1, false, [
    { id: 'a', name: legacy[0]!, hidden: false, renamable: true },
    { id: 'b', name: legacy[1]!, hidden: true, renamable: true },
  ]);
  assert.deepEqual(revealed.names, [`${long.slice(0, 78)} 2`]);
  assert.deepEqual(revealed.renamed, [{ id: 'b', name: `${long.slice(0, 78)} 3` }]);
});

test('a copy number is read against the creature name, never guessed from the name alone', () => {
  assert.equal(copyNumber('Goblin 3', 'Goblin'), 3);
  assert.equal(copyNumber('Goblin', 'Goblin'), 1);
  assert.equal(copyNumber('Goblin Chefe', 'Goblin'), null);
  assert.equal(copyNumber('Lobo Atroz 12', 'Lobo Atroz'), 12);
  // A number that belongs to the creature's name is not a copy number.
  assert.equal(copyNumber('Construto 7', 'Construto 7'), 1);
  assert.equal(copyNumber('Construto 7 2', 'Construto 7'), 2);
  assert.equal(copyNumber('Construto', 'Construto 7'), null);
});

test('visible copies number after the visible ones only, so a hidden copy leaves no gap', () => {
  const copy = (id: string, name: string, hidden = false, renamable = true) => ({ id, name, hidden, renamable });
  const existing = [copy('a', 'Goblin 1'), copy('b', 'Goblin 2'), copy('c', 'Goblin 3', true)];

  // The hidden Goblin 3 gives its name up and the master keeps unique names.
  assert.deepEqual(placeCopies('Goblin', 1, false, existing), {
    names: ['Goblin 3'],
    renamed: [{ id: 'c', name: 'Goblin 4' }],
  });
  // A new hidden copy numbers after every name.
  assert.deepEqual(placeCopies('Goblin', 2, true, existing), { names: ['Goblin 4', 'Goblin 5'], renamed: [] });
  // Revealing the hidden copy places it right after the visible ones.
  assert.deepEqual(placeCopies('Goblin', 1, false, existing.slice(0, 2)), { names: ['Goblin 3'], renamed: [] });
  // Revealing one of two hidden copies takes the next visible number from the other.
  const twoHidden = [copy('a', 'Goblin 1'), copy('b', 'Goblin 2', true), copy('c', 'Goblin 3', true)];
  assert.deepEqual(placeCopies('Goblin', 1, false, twoHidden.filter((entry) => entry.id !== 'c')), {
    names: ['Goblin 2'],
    renamed: [{ id: 'b', name: 'Goblin 3' }],
  });
  // A name the master typed is never taken over.
  assert.deepEqual(placeCopies('Goblin', 1, false, [copy('a', 'Goblin', true, false)]), {
    names: ['Goblin'],
    renamed: [],
  });
});

test('the turn queue follows initiative and marks only fallen monsters as defeated', () => {
  const base = { dexModifier: 0, tieOrder: 0 };
  const queue = turnQueue([
    { ...base, id: 'goblin', source: 'statblock', hpCurrent: 0, initiative: 18 },
    { ...base, id: 'kaelen', source: 'character', hpCurrent: 0, initiative: 12 },
    { ...base, id: 'bandit', source: 'manual', hpCurrent: 4, initiative: 15 },
    { ...base, id: 'late', source: 'statblock', hpCurrent: 7, initiative: null },
  ]);
  assert.deepEqual(queue, [
    { id: 'goblin', defeated: true },
    { id: 'bandit', defeated: false },
    { id: 'kaelen', defeated: false },
  ]);
  assert.equal(isDefeated({ source: 'manual', hpCurrent: -2 }), true);
  assert.equal(isDefeated({ source: 'character', hpCurrent: 0 }), false);
});
