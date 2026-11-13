import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import type { SceneListResponse, SceneView } from '@quest-fast/shared';
import { activeSceneQuery, closeScene, mergeScene, removeScene, sceneListQuery, sceneQuery } from '../src/lib/scene-cache.ts';

const CAMPAIGN = 'c1';
let next = 0;

/** Each test gets scene ids of its own: the version record outlives a client. */
function scene(id: string, version: number, changes: Partial<SceneView> = {}): SceneView {
  return {
    id,
    campaignId: CAMPAIGN,
    name: 'Salão em ruínas',
    mapUrl: `/maps/${id}.jpg`,
    mapWidth: 1800,
    mapHeight: 1200,
    grid: { enabled: true, cellSize: 60, offsetX: 0, offsetY: 0, snap: true },
    active: false,
    version,
    createdAt: '2026-11-12T00:00:00.000Z',
    ...changes,
  };
}

function setup() {
  next += 1;
  const queryClient = new QueryClient();
  const ids = { a: `a${next}`, b: `b${next}` };
  return { queryClient, ...ids };
}

const activeOf = (queryClient: QueryClient) => queryClient.getQueryData<SceneView | null>(activeSceneQuery(CAMPAIGN).queryKey);
const listOf = (queryClient: QueryClient) => queryClient.getQueryData<SceneListResponse>(sceneListQuery(CAMPAIGN).queryKey);

test('an older version never replaces a newer one', () => {
  const { queryClient, a } = setup();
  mergeScene(queryClient, CAMPAIGN, scene(a, 3, { active: true, name: 'Novo' }));
  mergeScene(queryClient, CAMPAIGN, scene(a, 2, { active: true, name: 'Antigo' }));
  assert.equal(activeOf(queryClient)?.name, 'Novo');
  assert.equal(queryClient.getQueryData<{ scene: SceneView }>(sceneQuery(CAMPAIGN, a).queryKey)?.scene.version, 3);
});

test('a closed scene leaves the table only when it was the one open', () => {
  const { queryClient, a, b } = setup();
  mergeScene(queryClient, CAMPAIGN, scene(a, 1, { active: true }));
  mergeScene(queryClient, CAMPAIGN, scene(b, 1, { active: false }));
  assert.equal(activeOf(queryClient)?.id, a);
  mergeScene(queryClient, CAMPAIGN, scene(a, 2, { active: false }));
  assert.equal(activeOf(queryClient), null);
});

test('opening a scene leaves a single row marked in the master list, whatever the order', () => {
  const { queryClient, a, b } = setup();
  queryClient.setQueryData<SceneListResponse>(sceneListQuery(CAMPAIGN).queryKey, {
    scenes: [{ ...scene(b, 1), active: false }, { ...scene(a, 1), active: true }].map(({ id, name, mapUrl, mapWidth, mapHeight, active, createdAt }) =>
      ({ id, name, mapUrl, mapWidth, mapHeight, active, createdAt })),
  });
  // The opened one arrives before the closed one.
  mergeScene(queryClient, CAMPAIGN, scene(b, 2, { active: true }));
  assert.deepEqual(listOf(queryClient)?.scenes.map((row) => [row.id, row.active]), [[b, true], [a, false]]);
  mergeScene(queryClient, CAMPAIGN, scene(a, 2, { active: false }));
  assert.deepEqual(listOf(queryClient)?.scenes.map((row) => [row.id, row.active]), [[b, true], [a, false]]);
  assert.equal(activeOf(queryClient)?.id, b);
});

test('a new scene enters the master list first', () => {
  const { queryClient, a, b } = setup();
  queryClient.setQueryData<SceneListResponse>(sceneListQuery(CAMPAIGN).queryKey, { scenes: [] });
  mergeScene(queryClient, CAMPAIGN, scene(a, 1));
  mergeScene(queryClient, CAMPAIGN, scene(b, 1));
  assert.deepEqual(listOf(queryClient)?.scenes.map((row) => row.id), [b, a]);
});

test('the list a player never asked for stays empty', () => {
  const { queryClient, a } = setup();
  mergeScene(queryClient, CAMPAIGN, scene(a, 1, { active: true }));
  assert.equal(listOf(queryClient), undefined);
});

test('closing takes only that scene off the table', () => {
  const { queryClient, a, b } = setup();
  mergeScene(queryClient, CAMPAIGN, scene(a, 1, { active: true }));
  closeScene(queryClient, CAMPAIGN, b);
  assert.equal(activeOf(queryClient)?.id, a);
  closeScene(queryClient, CAMPAIGN, a);
  assert.equal(activeOf(queryClient), null);
});

test('removing a scene drops it from the list, the table and its detail', () => {
  const { queryClient, a, b } = setup();
  queryClient.setQueryData<SceneListResponse>(sceneListQuery(CAMPAIGN).queryKey, { scenes: [] });
  mergeScene(queryClient, CAMPAIGN, scene(a, 1, { active: true }));
  mergeScene(queryClient, CAMPAIGN, scene(b, 1));
  removeScene(queryClient, CAMPAIGN, a);
  assert.deepEqual(listOf(queryClient)?.scenes.map((row) => row.id), [b]);
  assert.equal(activeOf(queryClient), null);
  assert.equal(queryClient.getQueryData(sceneQuery(CAMPAIGN, a).queryKey), undefined);
});
