import test from 'node:test';
import assert from 'node:assert/strict';
import { INBOUND_PER_SECOND, createRateLimit, parseClientMessage } from './inbound.ts';

test('only a well-formed token.move is read', () => {
  assert.deepEqual(parseClientMessage('{"type":"token.move","tokenId":"t1","x":10.5,"y":20}'), {
    type: 'token.move',
    tokenId: 't1',
    x: 10.5,
    y: 20,
  });
  for (const raw of [
    'not json',
    'null',
    '[]',
    '{"type":"token.drop","tokenId":"t1","x":1,"y":1}',
    '{"type":"token.move","tokenId":"","x":1,"y":1}',
    `{"type":"token.move","tokenId":"${'t'.repeat(65)}","x":1,"y":1}`,
    '{"type":"token.move","tokenId":"t1","x":"1","y":1}',
    '{"type":"token.move","tokenId":"t1","x":1}',
    '{"type":"token.move","tokenId":"t1","x":1e400,"y":1}',
  ]) {
    assert.equal(parseClientMessage(raw), null, raw);
  }
});

test('a socket sends at most 40 messages a second; the rest is dropped', () => {
  let time = 5000;
  const allowed = createRateLimit(INBOUND_PER_SECOND, () => time);
  const first = Array.from({ length: 45 }, () => allowed());
  assert.equal(first.filter(Boolean).length, 40);
  assert.deepEqual(first.slice(38, 42), [true, true, false, false]);
  time += 999;
  assert.equal(allowed(), false);
  time += 1;
  assert.equal(allowed(), true);
});

test('an area.preview is read with its geometry normalised, or a null area to clear it', () => {
  assert.deepEqual(
    parseClientMessage('{"type":"area.preview","sceneId":"s1","area":{"shape":"cube","size":3,"x":1,"y":2,"angle":95},"done":true}'),
    { type: 'area.preview', sceneId: 's1', area: { shape: 'cube', size: 3, width: 1.5, x: 1, y: 2, angle: 90 }, done: true },
  );
  assert.deepEqual(parseClientMessage('{"type":"area.preview","sceneId":"s1","area":null}'), {
    type: 'area.preview',
    sceneId: 's1',
    area: null,
    done: false,
  });
  for (const raw of [
    '{"type":"area.preview","area":null}',
    '{"type":"area.preview","sceneId":"","area":null}',
    '{"type":"area.preview","sceneId":"s1","area":null,"done":1}',
    '{"type":"area.preview","sceneId":"s1","area":{"shape":"star","size":3,"x":1,"y":2}}',
    '{"type":"area.preview","sceneId":"s1","area":{"shape":"sphere","size":2,"x":1,"y":2}}',
    '{"type":"area.preview","sceneId":"s1"}',
  ]) {
    assert.equal(parseClientMessage(raw), null, raw);
  }
});
