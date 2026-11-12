import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type { CombatantView, EncounterView } from '@quest-fast/shared';
import { encounterQuery, mergeEncounter, settleRequest, startRequest, withHitPoints } from '../src/lib/combat-cache.ts';

const CAMPAIGN = 'c1';
const ENCOUNTER = 'e1';
const CHARACTER = 'k1';

function encounter(version: number, hpCurrent: number): EncounterView {
  const kaelen: CombatantView = {
    id: 'p1',
    source: 'character',
    characterId: CHARACTER,
    ownerId: 'u1',
    name: 'Kaelen',
    size: 'medium',
    hidden: false,
    initiative: 15,
    hasInitiative: true,
    dexModifier: 3,
    tieOrder: 0,
    ac: 15,
    hpMax: 38,
    hpCurrent,
    hpTemp: 0,
    healthBand: 'wounded',
    defeated: false,
    conditions: [],
    concentrating: false,
    deathSaves: { successes: 0, failures: 0 },
    reminders: [],
    attacks: [],
  };
  return {
    id: ENCOUNTER,
    campaignId: CAMPAIGN,
    name: 'Emboscada',
    status: 'active',
    round: 1,
    activeCombatantId: 'p1',
    activeHidden: false,
    version,
    createdAt: '2026-11-07T00:00:00.000Z',
    startedAt: '2026-11-07T00:00:00.000Z',
    endedAt: null,
    combatants: [kaelen],
    summary: null,
  };
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function serverAnswers(view: EncounterView) {
  globalThis.fetch = (async () => Response.json({ encounter: view })) as typeof fetch;
}

/** An encounter already known at version 1, and a sheet open at 38 hit points. */
async function openSheet() {
  const client = new QueryClient();
  serverAnswers(encounter(1, 38));
  await client.fetchQuery(encounterQuery(CAMPAIGN, ENCOUNTER));

  const sheet = { fetches: 0, hpCurrent: 38 };
  const observer = new QueryObserver(client, {
    queryKey: ['character', CAMPAIGN, CHARACTER],
    queryFn: async () => {
      sheet.fetches += 1;
      return { hpCurrent: sheet.hpCurrent };
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  await client.fetchQuery({ queryKey: ['character', CAMPAIGN, CHARACTER], staleTime: Infinity });
  sheet.fetches = 1;
  const shown = async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return observer.getCurrentResult().data;
  };
  return { client, sheet, shown, close: () => { unsubscribe(); client.clear(); } };
}

test('an open sheet follows a fight when the socket arrives first', async () => {
  const { client, sheet, shown, close } = await openSheet();
  sheet.hpCurrent = 1;
  mergeEncounter(client, CAMPAIGN, encounter(2, 1));
  assert.deepEqual(await shown(), { hpCurrent: 1 });
  close();
});

test('an open sheet follows a fight when the GET arrives before the socket', async () => {
  const { client, sheet, shown, close } = await openSheet();
  sheet.hpCurrent = 1;
  serverAnswers(encounter(2, 1));
  await client.fetchQuery(encounterQuery(CAMPAIGN, ENCOUNTER));
  mergeEncounter(client, CAMPAIGN, encounter(2, 1));
  assert.deepEqual(await shown(), { hpCurrent: 1 });
  close();
});

test('a GET that brings no change to the character leaves the sheet alone', async () => {
  const { client, sheet, shown, close } = await openSheet();
  serverAnswers(encounter(2, 38));
  await client.fetchQuery(encounterQuery(CAMPAIGN, ENCOUNTER));
  await shown();
  assert.equal(sheet.fetches, 1);
  close();
});

test('an answer older than the known encounter changes nothing', async () => {
  const { client, sheet, shown, close } = await openSheet();
  sheet.hpCurrent = 1;
  mergeEncounter(client, CAMPAIGN, encounter(3, 1));
  await shown();
  const fetchesAfterUpdate = sheet.fetches;

  serverAnswers(encounter(2, 20));
  const answer = await client.fetchQuery(encounterQuery(CAMPAIGN, ENCOUNTER));
  mergeEncounter(client, CAMPAIGN, encounter(2, 20));
  await shown();

  assert.equal(answer.encounter.version, 3);
  assert.equal(answer.encounter.combatants[0]!.hpCurrent, 1);
  assert.equal(sheet.fetches, fetchesAfterUpdate);
  close();
});

test('hit points change on screen before the server answers, by the shared rules', () => {
  const view = withHitPoints(encounter(4, 30), 'p1', 'damage', 10);
  const kaelen = view.combatants[0]!;
  assert.deepEqual([kaelen.hpCurrent, kaelen.healthBand, view.version], [20, 'wounded', 4]);
  assert.equal(withHitPoints(view, 'p1', 'heal', 50).combatants[0]!.hpCurrent, 38);
  assert.equal(withHitPoints(view, 'p1', 'temp', 5).combatants[0]!.hpTemp, 5);
});

test('a combatant whose numbers this viewer does not know is left as it is', () => {
  const unknown = encounter(4, 30);
  unknown.combatants[0] = { ...unknown.combatants[0]!, hpCurrent: null, hpMax: null, hpTemp: null };
  assert.deepEqual(withHitPoints(unknown, 'p1', 'damage', 10), unknown);
  assert.deepEqual(withHitPoints(unknown, 'missing', 'damage', 10), unknown);
});

test('a card stays busy until its own request settles, whatever the others do', () => {
  // Hit points on the goblin, then concentration on Bram, both in flight.
  let inFlight = startRequest(startRequest({}, 'goblin'), 'bram');
  assert.deepEqual(Object.keys(inFlight).sort(), ['bram', 'goblin']);
  // The goblin's answer arrives first: Bram is still waiting.
  inFlight = settleRequest(inFlight, 'goblin');
  assert.deepEqual(Object.keys(inFlight), ['bram']);
  inFlight = settleRequest(inFlight, 'bram');
  assert.deepEqual(inFlight, {});
});

test('two requests on one card keep it busy until both settle', () => {
  let inFlight = startRequest(startRequest({}, 'goblin'), 'goblin');
  inFlight = settleRequest(inFlight, 'goblin');
  assert.deepEqual(Object.keys(inFlight), ['goblin']);
  inFlight = settleRequest(inFlight, 'goblin');
  assert.deepEqual(inFlight, {});
  // Settling what is not in flight changes nothing.
  assert.deepEqual(settleRequest({}, 'goblin'), {});
});
