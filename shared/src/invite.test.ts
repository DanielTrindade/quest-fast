import test from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_ALPHABET, INVITE_CODE_LENGTH, generateInviteCode, normalizeInviteCode } from './invite.ts';

test('generates a code of the defined length', () => {
  assert.equal(generateInviteCode().length, INVITE_CODE_LENGTH);
});

test('generates codes using only the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    for (const char of generateInviteCode()) {
      assert.ok(INVITE_ALPHABET.includes(char), `unexpected character: ${char}`);
    }
  }
});

test('the alphabet holds no characters that get confused when read aloud', () => {
  for (const ambiguous of ['O', '0', 'I', '1', 'L']) {
    assert.ok(!INVITE_ALPHABET.includes(ambiguous), `${ambiguous} should be out of the alphabet`);
  }
});

test('normalizes case and surrounding spaces', () => {
  assert.equal(normalizeInviteCode('  mesa42 '), 'MESA42');
});

test('normalizes separators used by whoever copies the code by hand', () => {
  assert.equal(normalizeInviteCode('mes-a42'), 'MESA42');
  assert.equal(normalizeInviteCode('MES A42'), 'MESA42');
});

test('rejects a code whose length differs from the expected one', () => {
  assert.equal(normalizeInviteCode('MESA4'), undefined);
  assert.equal(normalizeInviteCode('MESA425'), undefined);
});

test('rejects a code with a character outside the alphabet', () => {
  assert.equal(normalizeInviteCode('MES@42'), undefined);
  assert.equal(normalizeInviteCode('MESA4O'), undefined);
});

test('rejects empty input', () => {
  assert.equal(normalizeInviteCode(''), undefined);
  assert.equal(normalizeInviteCode('   '), undefined);
});

test('generates codes with enough entropy not to repeat in practice', () => {
  // One collision in 500 draws is possible and does not indicate a defect. A
  // broken generator, however, collapses to very few distinct values.
  const generated = new Set(Array.from({ length: 500 }, () => generateInviteCode()));
  assert.ok(generated.size >= 495, `only ${generated.size} distinct codes out of 500`);
});

test('uses the full alphabet across many draws', () => {
  const seen = new Set([...Array.from({ length: 400 }, () => generateInviteCode()).join('')]);
  assert.equal(seen.size, INVITE_ALPHABET.length);
});
