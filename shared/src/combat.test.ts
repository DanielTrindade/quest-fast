import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITIONS,
  concentrationDc,
  copyNumber,
  deathSaveOutcome,
  healthBand,
  isActiveCondition,
  isCondition,
  isDefeated,
  nextTurn,
  numberCopies,
  placeCopies,
  previousTurn,
  sortInitiative,
  tickConditions,
  turnQueue,
  type ActiveCondition,
} from './combat.ts';

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
