import test from 'node:test';
import assert from 'node:assert/strict';
import { leftActions } from '../src/lib/attack-range-context.ts';

const page = { staged: false, collapsed: false, inSight: true };
const staged = { staged: true, collapsed: false, inSight: true };

test('the page panel keeps the range only on its Ações tab', () => {
  assert.equal(leftActions({ ...page, tab: 'actions' }), false);
  assert.equal(leftActions({ ...page, tab: 'dice' }), true);
});

test('under the full screen the page panel sleeps and decides nothing', () => {
  assert.equal(leftActions({ ...page, inSight: false, tab: 'dice' }), false);
});

test('on the full screen, the map buttons and the chat toast leave the Ações tab too', () => {
  // "Ajustar grid", "Pôr tokens" and "Fog of war" bring the panel to Mapa.
  assert.equal(leftActions({ ...staged, tab: 'map' }), true);
  // The toast of a new chat line opens the panel on Chat.
  assert.equal(leftActions({ ...staged, tab: 'chat' }), true);
  // Folded, the Ações tab is out of sight.
  assert.equal(leftActions({ ...staged, collapsed: true, inSight: false, tab: 'actions' }), true);
  assert.equal(leftActions({ ...staged, tab: 'actions' }), false);
});
