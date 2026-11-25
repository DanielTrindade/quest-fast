import test from 'node:test';
import assert from 'node:assert/strict';
import {
  damageTypeFromText,
  damageUnderEffects,
  dropConcentration,
  effectiveAc,
  effectiveHpMax,
  hpAfterMaxChange,
  parseEffectInput,
  setEffect,
  speedUnderEffects,
  startTurnEffects,
  tickEffects,
  type CombatEffect,
  type EffectModifiers,
} from './effects.ts';
import { effectiveSpeed } from './turn.ts';

let next = 0;
function effect(modifiers: EffectModifiers, extra: Partial<CombatEffect> = {}): CombatEffect {
  next += 1;
  return { id: `e${next}`, name: `Efeito ${next}`, modifiers, duration: 'encounter', concentration: false, ...extra };
}

test('a damage type is read in Portuguese or English, with or without accents', () => {
  assert.equal(damageTypeFromText('Cortante'), 'slashing');
  assert.equal(damageTypeFromText('fogo mágico'), 'fire');
  assert.equal(damageTypeFromText('Fire'), 'fire');
  assert.equal(damageTypeFromText('ÁCIDO'), 'acid');
  assert.equal(damageTypeFromText('Elétrico'), 'lightning');
  assert.equal(damageTypeFromText('psíquico'), 'psychic');
});

test('a row of no known type, or of two, has no type', () => {
  assert.equal(damageTypeFromText(''), null);
  assert.equal(damageTypeFromText('especial'), null);
  assert.equal(damageTypeFromText('cortante + fogo'), null);
  // One type written twice is still one.
  assert.equal(damageTypeFromText('fogo (fire)'), 'fire');
});

test('armor class: the highest set value or the base, plus every bonus', () => {
  assert.equal(effectiveAc(15, []), 15);
  assert.equal(effectiveAc(15, [effect({ ac: { mode: 'add', value: 2 } }), effect({ ac: { mode: 'add', value: 5 } })]), 22);
  // Mage Armor sets 13 + Dex; a higher base wins.
  assert.equal(effectiveAc(11, [effect({ ac: { mode: 'set', value: 16 } })]), 16);
  assert.equal(effectiveAc(18, [effect({ ac: { mode: 'set', value: 16 } })]), 18);
  assert.equal(effectiveAc(11, [effect({ ac: { mode: 'set', value: 13 } }), effect({ ac: { mode: 'set', value: 16 } }), effect({ ac: { mode: 'add', value: 2 } })]), 18);
});

test('speed: the highest set value or the base, plus bonuses, halved once', () => {
  assert.equal(speedUnderEffects(9, []), 9);
  // Longstrider.
  assert.equal(speedUnderEffects(9, [effect({ speed: { mode: 'add', value: 3 } })]), 12);
  assert.equal(speedUnderEffects(9, [effect({ speed: { mode: 'set', value: 0 } })]), 0);
  assert.equal(speedUnderEffects(9, [effect({ speed: { mode: 'half' } }), effect({ speed: { mode: 'half' } })]), 4.5);
  assert.equal(speedUnderEffects(9, [effect({ speed: { mode: 'add', value: 3 } }), effect({ speed: { mode: 'half' } })]), 6);
  assert.equal(speedUnderEffects(3, [effect({ speed: { mode: 'add', value: -6 } })]), 0);
});

test('the conditions still apply on top of the effects', () => {
  const longstrider = [effect({ speed: { mode: 'add', value: 3 } })];
  assert.equal(effectiveSpeed(9, [], longstrider), 12);
  assert.equal(effectiveSpeed(9, [{ condition: 'exhaustion', level: 2 }], longstrider), 9);
  assert.equal(effectiveSpeed(9, [{ condition: 'grappled' }], longstrider), 0);
});

test('a higher maximum raises the current hit points; a lower one only cuts above it', () => {
  assert.equal(effectiveHpMax(30, [effect({ hpMax: 5 }), effect({ hpMax: 5 })]), 40);
  assert.equal(hpAfterMaxChange(20, 30, 35), 25);
  // Aid ends: what is above the new maximum is lost, the rest stays.
  assert.equal(hpAfterMaxChange(35, 35, 30), 30);
  assert.equal(hpAfterMaxChange(12, 35, 30), 12);
  assert.equal(hpAfterMaxChange(0, 30, 35), 5);
});

test('damage under effects: immune 0, resistant half, vulnerable double', () => {
  const resistFire = effect({ resistances: ['fire'] });
  assert.deepEqual(damageUnderEffects(11, 'Fogo', [resistFire]), { amount: 5, adjustment: 'resistant', damageType: 'fire' });
  assert.deepEqual(damageUnderEffects(11, 'Fogo', [effect({ vulnerabilities: ['fire'] })]), { amount: 22, adjustment: 'vulnerable', damageType: 'fire' });
  assert.deepEqual(damageUnderEffects(11, 'fire', [resistFire, effect({ immunities: ['fire'] })]), { amount: 0, adjustment: 'immune', damageType: 'fire' });
  // Resistance and vulnerability cancel out.
  assert.deepEqual(damageUnderEffects(11, 'fogo', [resistFire, effect({ vulnerabilities: ['fire'] })]), { amount: 11, adjustment: null, damageType: 'fire' });
  // Another type, or one not recognised, keeps the amount.
  assert.deepEqual(damageUnderEffects(11, 'Cortante', [resistFire]), { amount: 11, adjustment: null, damageType: 'slashing' });
  assert.deepEqual(damageUnderEffects(11, 'fogo e frio', [resistFire]), { amount: 11, adjustment: null, damageType: null });
});

test('one effect per name: applying it again replaces the old one', () => {
  const first = effect({ ac: { mode: 'add', value: 2 } }, { name: 'Escudo da Fé' });
  const again = effect({ ac: { mode: 'add', value: 2 } }, { name: 'escudo da fe ' });
  const other = effect({ hpMax: 5 }, { name: 'Auxílio' });
  const once = setEffect([first, other], again);
  assert.deepEqual(once.effects, [again, other]);
  assert.equal(once.replaced, first);
  assert.deepEqual(setEffect([other], first), { effects: [other, first], replaced: null });
});

test('rounds run out at the end of the bearer turn; the rest stays', () => {
  const two = effect({ hpMax: 1 }, { duration: 'rounds', roundsLeft: 2 });
  const one = effect({ hpMax: 1 }, { duration: 'rounds', roundsLeft: 1 });
  const lasting = effect({ hpMax: 1 }, { duration: 'none' });
  const shield = effect({ ac: { mode: 'add', value: 5 } }, { duration: 'untilTurnStart' });
  const { remaining, expired } = tickEffects([two, one, lasting, shield]);
  assert.deepEqual(remaining, [{ ...two, roundsLeft: 1 }, lasting, shield]);
  assert.deepEqual(expired, [one]);
});

test('what lasts until the turn begins ends when it begins', () => {
  const shield = effect({ ac: { mode: 'add', value: 5 } }, { duration: 'untilTurnStart' });
  const lasting = effect({ hpMax: 1 });
  assert.deepEqual(startTurnEffects([shield, lasting]), { remaining: [lasting], expired: [shield] });
});

test('a concentration that ends takes its effects with it, and only those', () => {
  const held = effect({ ac: { mode: 'add', value: 2 } }, { sourceCombatantId: 'cleric', concentration: true });
  const notHeld = effect({ hpMax: 5 }, { sourceCombatantId: 'cleric' });
  const otherCaster = effect({ resistances: ['fire'] }, { sourceCombatantId: 'wizard', concentration: true });
  assert.deepEqual(dropConcentration([held, notHeld, otherCaster], 'cleric'), { remaining: [notHeld, otherCaster], expired: [held] });
});

test('an input is normalised: trimmed name, empty lists dropped', () => {
  const parsed = parseEffectInput({
    name: '  Escudo da Fé ',
    modifiers: { ac: { mode: 'add', value: 2 }, resistances: [] },
    duration: 'rounds',
    roundsLeft: 100,
    sourceCombatantId: 'cleric',
    concentration: true,
  });
  assert.deepEqual(parsed, {
    ok: true,
    effect: { name: 'Escudo da Fé', modifiers: { ac: { mode: 'add', value: 2 } }, duration: 'rounds', roundsLeft: 100, sourceCombatantId: 'cleric', concentration: true },
  });
  assert.deepEqual(parseEffectInput({ name: 'Lentidão', modifiers: { speed: { mode: 'half' } }, duration: 'encounter' }), {
    ok: true,
    effect: { name: 'Lentidão', modifiers: { speed: { mode: 'half' } }, duration: 'encounter', concentration: false },
  });
});

test('an input that is wrong is refused with a reason', () => {
  const base = { name: 'Efeito', modifiers: { hpMax: 5 }, duration: 'encounter' };
  const refused = (input: unknown) => assert.equal(parseEffectInput(input).ok, false, JSON.stringify(input));
  refused(null);
  refused({ ...base, name: '   ' });
  refused({ ...base, name: 'x'.repeat(61) });
  refused({ ...base, modifiers: {} });
  refused({ ...base, modifiers: { ac: { mode: 'add', value: 0 } } });
  refused({ ...base, modifiers: { ac: { mode: 'set', value: 41 } } });
  refused({ ...base, modifiers: { speed: { mode: 'add', value: 2 } } });
  refused({ ...base, modifiers: { speed: { mode: 'half', value: 3 } } });
  refused({ ...base, modifiers: { hpMax: 0 } });
  refused({ ...base, modifiers: { resistances: ['fogo'] } });
  refused({ ...base, modifiers: { resistances: ['fire', 'fire'] } });
  refused({ ...base, duration: 'forever' });
  refused({ ...base, duration: 'rounds' });
  refused({ ...base, duration: 'rounds', roundsLeft: 101 });
  refused({ ...base, roundsLeft: 3 });
  refused({ ...base, concentration: true });
  refused({ ...base, concentration: 'yes', sourceCombatantId: 'cleric' });
  refused({ ...base, sourceCombatantId: '' });
});
