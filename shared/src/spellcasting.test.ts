import test from 'node:test';
import assert from 'node:assert/strict';
import { castBlockedReason, castCircles, castSpell } from './spellcasting.ts';
import type { SpellSlot } from './sheet.ts';

function slots(...pairs: Array<[number, number]>): SpellSlot[] {
  const all = Array.from({ length: 9 }, () => ({ total: 0, spent: 0 }));
  pairs.forEach(([total, spent], index) => { all[index] = { total, spent }; });
  return all;
}

const fireball = { level: 3, ritual: false };
const detectMagic = { level: 1, ritual: true };
const cantrip = { level: 0, ritual: false };

test('a spell may take a free slot of its circle or higher, lowest first', () => {
  assert.deepEqual(castCircles(fireball, slots([4, 0], [3, 0], [2, 2], [1, 0])), [4]);
  assert.deepEqual(castCircles(fireball, slots([4, 0], [3, 0], [2, 1], [1, 0])), [3, 4]);
  assert.deepEqual(castCircles(cantrip, slots([4, 0])), []);
});

test('casting spends one slot of the chosen circle and nothing else', () => {
  const result = castSpell(fireball, slots([4, 0], [3, 0], [2, 1], [1, 0]), { circle: 4 });
  assert.ok(result.ok);
  assert.equal(result.circle, 4);
  assert.deepEqual(result.slots.slice(0, 4), [{ total: 4, spent: 0 }, { total: 3, spent: 0 }, { total: 2, spent: 1 }, { total: 1, spent: 1 }]);
});

test('a circle below the spell, a spent circle or a cantrip are refused', () => {
  const sheet = slots([4, 0], [3, 0], [2, 2]);
  assert.deepEqual(castSpell(fireball, sheet, { circle: 2 }), { ok: false, error: 'Esta magia precisa de um espaço do 3º círculo ou acima.' });
  assert.deepEqual(castSpell(fireball, sheet, { circle: 3 }), { ok: false, error: 'Sem espaços livres do 3º círculo.' });
  assert.deepEqual(castSpell(fireball, sheet, { circle: 10 }), { ok: false, error: 'Círculo inválido.' });
  assert.equal(castSpell(cantrip, sheet, { circle: 1 }).ok, false);
});

test('a ritual spends no slot, and only a ritual spell may be cast as one', () => {
  const empty = slots([2, 2]);
  const ritual = castSpell(detectMagic, empty, { ritual: true });
  assert.ok(ritual.ok);
  assert.equal(ritual.circle, null);
  assert.deepEqual(ritual.slots, empty);
  assert.deepEqual(castSpell(fireball, empty, { ritual: true }), { ok: false, error: 'Esta magia não pode ser conjurada como ritual.' });
});

test('the reason a spell cannot be cast names the lowest circle it needs', () => {
  assert.equal(castBlockedReason(fireball, slots([4, 0], [3, 0], [2, 2])), 'Sem espaços do 3º círculo ou acima.');
  assert.equal(castBlockedReason(detectMagic, slots([2, 2])), null);
  assert.equal(castBlockedReason(fireball, slots([4, 0], [3, 0], [2, 0])), null);
});
