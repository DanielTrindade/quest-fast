import test from 'node:test';
import assert from 'node:assert/strict';
import { initiativeOf, sortInitiative, turnQueue } from './combat.ts';
import {
  NO_SUMMON_LINK,
  isOpenToTable,
  isSummonInitiativeMode,
  summonLinkError,
  summonsEnding,
  tickSummonRounds,
} from './summons.ts';
import { validateSummonSheet } from './validation.ts';
import type { SummonSheetInput } from './api.ts';

const entry = (id: string, initiative: number | null, followsId: string | null = null, dexModifier = 0) => ({
  id,
  initiative,
  dexModifier,
  tieOrder: 0,
  followsId,
});

test('a summon acting with its summoner comes right after it, with its count', () => {
  const sorted = sortInitiative([
    entry('goblin', 15),
    entry('construct', null, 'kaelen'),
    entry('kaelen', 12),
    entry('wolf', 8),
  ]);
  assert.deepEqual(sorted.map((c) => [c.id, c.initiative]), [['goblin', 15], ['kaelen', 12], ['construct', 12], ['wolf', 8]]);
});

test('the own initiative of a summon is ignored while it acts with its summoner', () => {
  const sorted = sortInitiative([entry('kaelen', 5), entry('beast', 20, 'kaelen'), entry('goblin', 10)]);
  assert.deepEqual(sorted.map((c) => c.id), ['goblin', 'kaelen', 'beast']);
});

test('several summons keep the order they were given', () => {
  const sorted = sortInitiative([entry('zombie-1', null, 'mira'), entry('mira', 14), entry('zombie-2', null, 'mira')]);
  assert.deepEqual(sorted.map((c) => c.id), ['mira', 'zombie-1', 'zombie-2']);
});

test('in a chain each summon acts right after its own summoner, before the next sibling', () => {
  const sorted = sortInitiative([
    entry('zombie-1', null, 'mira'),
    entry('mira', 14),
    entry('zombie-2', null, 'mira'),
    entry('servant', null, 'zombie-1'),
  ]);
  assert.deepEqual(sorted.map((c) => [c.id, c.initiative]), [['mira', 14], ['zombie-1', 14], ['servant', 14], ['zombie-2', 14]]);
});

test('a summon listed before its own summoner still acts after it', () => {
  const sorted = sortInitiative([entry('servant', null, 'zombie'), entry('zombie', null, 'mira'), entry('mira', 14)]);
  assert.deepEqual(sorted.map((c) => c.id), ['mira', 'zombie', 'servant']);
});

test('a summon waits with a summoner still without initiative', () => {
  const list = [entry('kaelen', null), entry('construct', 17, 'kaelen'), entry('goblin', 3)];
  assert.deepEqual(sortInitiative(list).map((c) => c.id), ['goblin']);
  assert.equal(initiativeOf(list[1], list), null);
});

test('a summon whose summoner left, or a loop, keeps its own initiative', () => {
  const sorted = sortInitiative([entry('orphan', 9, 'gone'), entry('a', 4, 'b'), entry('b', 6, 'a')]);
  assert.deepEqual(sorted.map((c) => [c.id, c.initiative]), [['orphan', 9], ['b', 6], ['a', 4]]);
});

test('initiativeOf reads the count of the summoner or the combatant own', () => {
  const list = [entry('kaelen', 12), entry('construct', null, 'kaelen'), entry('goblin', 7)];
  assert.equal(initiativeOf(list[1], list), 12);
  assert.equal(initiativeOf(list[2], list), 7);
});

test('sorting with summons does not mutate the input', () => {
  const input = [entry('construct', null, 'kaelen'), entry('kaelen', 12)];
  sortInitiative(input);
  assert.equal(input[0].initiative, null);
  assert.deepEqual(input.map((c) => c.id), ['construct', 'kaelen']);
});

test('the turn queue walks the summon right after its summoner', () => {
  const queue = turnQueue([
    { ...entry('kaelen', 12), source: 'character', hpCurrent: 10 },
    { ...entry('construct', null, 'kaelen'), source: 'statblock', hpCurrent: 0 },
    { ...entry('goblin', 15), source: 'statblock', hpCurrent: 7 },
  ]);
  assert.deepEqual(queue, [
    { id: 'goblin', defeated: false },
    { id: 'kaelen', defeated: false },
    { id: 'construct', defeated: true },
  ]);
});

test('initiative modes are recognised', () => {
  assert.equal(isSummonInitiativeMode('withSummoner'), true);
  assert.equal(isSummonInitiativeMode('own'), true);
  assert.equal(isSummonInitiativeMode('after'), false);
  assert.equal(isSummonInitiativeMode(undefined), false);
});

test('a summon link holds together only with a summoner where one is needed', () => {
  assert.equal(summonLinkError(NO_SUMMON_LINK), undefined);
  assert.equal(summonLinkError({ summonerId: 'k', initiativeMode: 'withSummoner', concentration: true, rounds: 10 }), undefined);
  assert.match(summonLinkError({ ...NO_SUMMON_LINK, initiativeMode: 'withSummoner' })!, /quem fez a invocação/);
  assert.match(summonLinkError({ ...NO_SUMMON_LINK, concentration: true })!, /concentração/);
  assert.match(summonLinkError({ ...NO_SUMMON_LINK, initiativeMode: 'later' as never })!, /age junto/);
});

test('a summon duration is a whole number of rounds from 1 to 100', () => {
  for (const rounds of [1, 10, 100]) assert.equal(summonLinkError({ ...NO_SUMMON_LINK, rounds }), undefined);
  for (const rounds of [0, 101, 1.5, -3]) assert.match(summonLinkError({ ...NO_SUMMON_LINK, rounds })!, /rounds/);
});

test('a character or a controlled creature is open to the table; a monster is not', () => {
  assert.equal(isOpenToTable({ source: 'character', controllerId: null }), true);
  assert.equal(isOpenToTable({ source: 'statblock', controllerId: 'player-1' }), true);
  assert.equal(isOpenToTable({ source: 'manual', controllerId: 'player-1' }), true);
  assert.equal(isOpenToTable({ source: 'statblock', controllerId: null }), false);
  assert.equal(isOpenToTable({ source: 'manual', controllerId: null }), false);
});

test('a duration in rounds counts down at the end of the turn of the summon', () => {
  assert.deepEqual(tickSummonRounds(null), { roundsLeft: null, expired: false });
  assert.deepEqual(tickSummonRounds(3), { roundsLeft: 2, expired: false });
  assert.deepEqual(tickSummonRounds(1), { roundsLeft: 0, expired: true });
  assert.deepEqual(tickSummonRounds(0), { roundsLeft: 0, expired: true });
});

const state = (id: string, summonerId: string | null, concentration: boolean, concentrating = false) => ({
  id,
  summonerId,
  concentration,
  concentrating,
});

test('a concentration summon ends when its summoner stops concentrating or is gone', () => {
  assert.deepEqual(
    summonsEnding([
      state('kaelen', null, false, false),
      state('construct', 'kaelen', true),
      state('mira', null, false, true),
      state('beast', 'mira', true),
      state('orphan', 'gone', true),
    ]),
    ['construct', 'orphan'],
  );
});

test('a summon without concentration stays, even when its summoner stops', () => {
  assert.deepEqual(summonsEnding([state('kaelen', null, false, false), state('skeleton', 'kaelen', false)]), []);
});

test('a concentration summon of an ending summon ends with it', () => {
  assert.deepEqual(
    summonsEnding([
      state('servant', 'spirit', true),
      state('spirit', 'kaelen', true, true),
      state('kaelen', null, false, false),
    ]),
    ['servant', 'spirit'],
  );
});

const sheet: SummonSheetInput = {
  name: 'Espírito do Construto',
  size: 'medium',
  ac: 16,
  hp: 40,
  speed: 9,
  initiativeBonus: 0,
  attacks: [{ name: 'Pancada', kind: 'attack', bonus: 6, damage: '1d8+4', damageType: 'contundente' }],
};

test('a simple summon sheet within the bounds has no errors', () => {
  assert.deepEqual(validateSummonSheet(sheet), {});
  assert.deepEqual(validateSummonSheet({ ...sheet, attacks: [], attacksPerAction: 2, speed: 10.5 }), {});
});

test('each field out of bounds says what is wrong, in Portuguese', () => {
  const errors = validateSummonSheet({
    name: ' ',
    size: 'colossal' as never,
    ac: 0,
    hp: 1000,
    speed: 9.25,
    initiativeBonus: 30,
    attacksPerAction: 0,
    attacks: [{ name: '', kind: 'attack', bonus: 2, damage: 'x' }],
  });
  assert.deepEqual(Object.keys(errors).sort(), ['ac', 'attacks', 'attacksPerAction', 'hp', 'initiativeBonus', 'name', 'size', 'speed']);
  assert.match(errors.name!, /nome da invocação/);
});

test('a summon sheet without an attack list is refused', () => {
  assert.equal(validateSummonSheet({ ...sheet, attacks: undefined as never }).attacks, 'Ataques inválidos.');
});
