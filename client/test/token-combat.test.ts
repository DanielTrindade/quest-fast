import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatantView, TokenView } from '@quest-fast/shared';
import { fightMarks, healthOf, turnName, type MarkedFight } from '../src/lib/token-combat.ts';

function token(id: string, link: Partial<Pick<TokenView, 'characterId' | 'combatantId'>>): TokenView {
  return { id, name: id, characterId: null, combatantId: null, ...link } as TokenView;
}

function fighter(id: string, extra: Partial<CombatantView> = {}): CombatantView {
  return { id, characterId: null, healthBand: 'unhurt', hpCurrent: 10, hpMax: 10, ...extra } as CombatantView;
}

function fight(activeCombatantId: string | null, combatants: CombatantView[]): MarkedFight {
  return { activeCombatantId, combatants };
}

test('outside a fight no token is marked', () => {
  assert.equal(fightMarks([token('a', { combatantId: 'c1' })], null).size, 0);
});

test('the token of the combatant whose turn it is is marked, the character found by its sheet', () => {
  const tokens = [token('kaelen', { characterId: 'ch1' }), token('goblin', { combatantId: 'c2' }), token('crate', {})];
  const marks = fightMarks(tokens, fight('c1', [fighter('c1', { characterId: 'ch1' }), fighter('c2')]));
  assert.equal(marks.get('kaelen')?.turn, true);
  assert.equal(marks.get('goblin')?.turn, false);
  assert.equal(marks.has('crate'), false);
  assert.equal(turnName(tokens, marks), 'kaelen');
});

test('a turn the server hides from a player marks no one', () => {
  const tokens = [token('goblin', { combatantId: 'c2' })];
  const marks = fightMarks(tokens, fight(null, [fighter('c2')]));
  assert.equal(marks.get('goblin')?.turn, false);
  assert.equal(turnName(tokens, marks), null);
});

test('health follows the hit points when known, the band otherwise', () => {
  assert.deepEqual(healthOf({ healthBand: 'wounded', hpCurrent: 6, hpMax: 8 }), { band: 'wounded', fraction: 0.75 });
  assert.deepEqual(healthOf({ healthBand: 'bloodied', hpCurrent: null, hpMax: null }), { band: 'bloodied', fraction: 1 / 3 });
  // Temporary hit points never push the arc past full.
  assert.deepEqual(healthOf({ healthBand: 'unhurt', hpCurrent: 12, hpMax: 10 }), { band: 'unhurt', fraction: 1 });
});

test('at 0 hit points there is no arc: the token already reads down or defeated', () => {
  assert.equal(healthOf({ healthBand: 'defeated', hpCurrent: 0, hpMax: 10 }), null);
});
