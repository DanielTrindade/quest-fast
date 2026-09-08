import test from 'node:test';
import assert from 'node:assert/strict';
import { ALFABETO_CONVITE, TAMANHO_CODIGO_CONVITE, gerarCodigoConvite, normalizarCodigoConvite } from './invite.ts';

test('gera código com o tamanho definido', () => {
  assert.equal(gerarCodigoConvite().length, TAMANHO_CODIGO_CONVITE);
});

test('gera código apenas com caracteres do alfabeto sem ambiguidade', () => {
  for (let i = 0; i < 200; i++) {
    for (const char of gerarCodigoConvite()) {
      assert.ok(ALFABETO_CONVITE.includes(char), `caractere inesperado: ${char}`);
    }
  }
});

test('o alfabeto não contém caracteres que se confundem ao ditar o código', () => {
  for (const ambiguo of ['O', '0', 'I', '1', 'L']) {
    assert.ok(!ALFABETO_CONVITE.includes(ambiguo), `${ambiguo} deveria estar fora do alfabeto`);
  }
});

test('normaliza caixa e espaços em volta', () => {
  assert.equal(normalizarCodigoConvite('  mesa42 '), 'MESA42');
});

test('normaliza separadores usados por quem copia o código à mão', () => {
  assert.equal(normalizarCodigoConvite('mes-a42'), 'MESA42');
  assert.equal(normalizarCodigoConvite('MES A42'), 'MESA42');
});

test('recusa código com tamanho diferente do esperado', () => {
  assert.equal(normalizarCodigoConvite('MESA4'), undefined);
  assert.equal(normalizarCodigoConvite('MESA425'), undefined);
});

test('recusa código com caractere fora do alfabeto', () => {
  assert.equal(normalizarCodigoConvite('MES@42'), undefined);
  assert.equal(normalizarCodigoConvite('MESA4O'), undefined);
});

test('recusa entrada vazia', () => {
  assert.equal(normalizarCodigoConvite(''), undefined);
  assert.equal(normalizarCodigoConvite('   '), undefined);
});

test('gera códigos com entropia suficiente para não repetir na prática', () => {
  // Uma colisão em 500 sorteios é possível e não indica defeito. Um gerador
  // quebrado, porém, colapsa para pouquíssimos valores distintos.
  const gerados = new Set(Array.from({ length: 500 }, () => gerarCodigoConvite()));
  assert.ok(gerados.size >= 495, `apenas ${gerados.size} códigos distintos em 500`);
});

test('usa toda a extensão do alfabeto ao longo de muitos sorteios', () => {
  const vistos = new Set([...Array.from({ length: 400 }, () => gerarCodigoConvite()).join('')]);
  assert.equal(vistos.size, ALFABETO_CONVITE.length);
});
