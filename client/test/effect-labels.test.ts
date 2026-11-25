import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEffect, CombatEffectPayload } from '@quest-fast/shared';
import { combatEventText } from '../src/lib/combat-feed.ts';
import { emptyEffectDraft, effectRequest } from '../src/lib/effect-draft.ts';
import { damageAdjustmentText, effectDurationShort, effectLabel, effectParts } from '../src/lib/effect-labels.ts';

function effect(extra: Partial<CombatEffect>): CombatEffect {
  return { id: 'e1', name: 'Efeito', modifiers: {}, duration: 'encounter', concentration: false, ...extra };
}

test('an effect reads as what it changes', () => {
  assert.deepEqual(effectParts(effect({ modifiers: { ac: { mode: 'add', value: 2 } } })), ['CA +2']);
  assert.deepEqual(effectParts(effect({ modifiers: { ac: { mode: 'set', value: 16 } } })), ['CA 16']);
  assert.deepEqual(effectParts(effect({ modifiers: { speed: { mode: 'add', value: 3 } } })), ['Deslocamento +3 m']);
  assert.deepEqual(effectParts(effect({ modifiers: { speed: { mode: 'add', value: -1.5 } } })), ['Deslocamento −1,5 m']);
  assert.deepEqual(effectParts(effect({ modifiers: { speed: { mode: 'half' } } })), ['Deslocamento pela metade']);
  assert.deepEqual(effectParts(effect({ modifiers: { hpMax: 5, resistances: ['fire', 'cold'] } })), ['PV máx. +5', 'Resistência: fogo, frio']);
});

test('the whole label carries the duration and the concentration', () => {
  const bless = effect({ name: 'Bênção', modifiers: { resistances: ['fire'] }, duration: 'rounds', roundsLeft: 3, concentration: true, sourceCombatantId: 'c' });
  assert.equal(effectLabel(bless), 'Bênção: Resistência: fogo, 3 rodadas, concentração');
  assert.equal(effectDurationShort(bless), '3 rod.');
  assert.equal(effectDurationShort(effect({ duration: 'untilTurnStart' })), 'até o próximo turno');
  assert.equal(effectDurationShort(effect({ duration: 'none' })), null);
  // A monster's, for a player: only the name.
  assert.equal(effectLabel({ id: 'e2', name: 'Pele de Pedra' }), 'Pele de Pedra');
});

test('a pending damage says why it is not what was rolled', () => {
  assert.equal(damageAdjustmentText({ damageType: 'Cortante', adjustment: 'resistant', rolled: 19 }), 'Resistência a cortante: rolou 19');
  assert.equal(damageAdjustmentText({ damageType: 'fogo', adjustment: 'immune', rolled: 8 }), 'Imune a fogo: rolou 8');
  assert.equal(damageAdjustmentText({ damageType: 'fogo' }), null);
});

test('the feed tells an effect put on, taken off and run out', () => {
  const base = { encounterId: 'x', combatantId: 'k', name: 'Kaelen', source: 'character', kind: 'combat.effect', effect: { id: 'e', name: 'Escudo da Fé' } } as const;
  const text = (action: CombatEffectPayload['action']) => combatEventText({ ...base, action });
  assert.equal(text('applied'), 'Kaelen está sob Escudo da Fé.');
  assert.equal(text('removed'), 'Kaelen não está mais sob Escudo da Fé.');
  assert.equal(text('expired'), 'Escudo da Fé de Kaelen acabou.');
});

test('the form sends what the server accepts, and says what is wrong first', () => {
  const draft = { ...emptyEffectDraft(), name: 'Escudo da Fé', acMode: 'add' as const, acValue: '2', duration: 'rounds' as const, rounds: '100', concentration: true };
  assert.deepEqual(effectRequest(draft, 'cleric'), {
    ok: true,
    request: { name: 'Escudo da Fé', modifiers: { ac: { mode: 'add', value: 2 } }, duration: 'rounds', roundsLeft: 100, sourceCombatantId: 'cleric', concentration: true },
  });
  const slow = { ...emptyEffectDraft(), name: 'Lentidão', speedMode: 'half' as const, speedValue: '9' };
  assert.deepEqual(effectRequest(slow, 'w'), { ok: true, request: { name: 'Lentidão', modifiers: { speed: { mode: 'half' } }, duration: 'encounter', sourceCombatantId: 'w', concentration: false } });
  assert.equal(effectRequest({ ...emptyEffectDraft(), name: 'Nada' }, 'w').ok, false);
  assert.equal(effectRequest({ ...draft, acValue: '' }, 'w').ok, false);
  assert.equal(effectRequest({ ...emptyEffectDraft(), name: 'Pele', damageRelation: 'resistances' }, 'w').ok, false);
  assert.deepEqual(effectRequest({ ...emptyEffectDraft(), name: 'Passos', speedMode: 'add', speedValue: '3' }, 'w').ok, true);
});
