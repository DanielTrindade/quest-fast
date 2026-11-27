import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySummonAttack, emptySummonDraft, summonRequest } from '../src/lib/summon-draft.ts';

test('a filled draft becomes the summon request, numbers parsed', () => {
  const draft = {
    ...emptySummonDraft(),
    name: ' Lobo ',
    ac: '13',
    hp: '11',
    speed: '12',
    attacks: [{ ...emptySummonAttack(), name: 'Mordida', bonus: '4', damage: '2d4+2', damageType: 'Perfurante' }],
    initiativeMode: 'own' as const,
    rounds: '10',
  };
  assert.deepEqual(summonRequest(draft, 'c-hazin'), {
    ok: true,
    request: {
      source: 'summon',
      sheet: {
        name: 'Lobo', size: 'medium', ac: 13, hp: 11, speed: 12, initiativeBonus: 0,
        attacks: [{ kind: 'attack', name: 'Mordida', bonus: 4, damage: '2d4+2', damageType: 'Perfurante' }],
      },
      summon: { summonerId: 'c-hazin', initiativeMode: 'own', concentration: false, rounds: 10 },
    },
  });
});

test('a decimal speed takes the comma, as the table writes it', () => {
  const result = summonRequest({ ...emptySummonDraft(), name: 'Familiar', ac: '12', hp: '1', speed: '10,5' }, 'c-hazin');
  assert.equal(result.ok && result.request.sheet.speed, 10.5);
});

test('what is wrong comes back field by field, the duration included', () => {
  const result = summonRequest({ ...emptySummonDraft(), rounds: '0' }, 'c-hazin');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(Object.keys(result.errors).sort(), ['ac', 'hp', 'name', 'rounds']);
});

test('each new attack row has a key of its own', () => {
  assert.notEqual(emptySummonAttack().key, emptySummonAttack().key);
});
