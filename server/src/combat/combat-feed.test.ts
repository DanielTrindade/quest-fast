import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatSessionEvent, FeedResponse, SessionEvent, SocketMessage } from '@quest-fast/shared';
import { body, createTestServer, signIn } from '../testing.ts';
import { PROFILES, advance, connect, runningEncounter, send, setup, until, type Request, type Setup } from './test-setup.ts';

/**
 * What a fight writes to the session feed, and what each reader gets of it.
 * The running encounter: Goblin 1 (18), Kaelen (15), Bandido (12, hidden),
 * Goblin 2 (10), Mira (5); Goblin 1 acts first.
 */

async function fight(s?: Setup) {
  const table = s ?? (await setup());
  const running = await runningEncounter(table);
  const at = (name: string, action = '') => `${running.path}/combatants/${running.id(name)}${action}`;
  return { s: table, ...running, at };
}

async function feed(s: Setup, request: Request): Promise<SessionEvent[]> {
  return (await body<FeedResponse>(await request(`${s.root}/feed`))).events;
}

function combatEvents(events: SessionEvent[], type: CombatSessionEvent['type']): CombatSessionEvent[] {
  return events.filter((event) => event.type === type) as CombatSessionEvent[];
}

test('damage to a monster reaches the master in full and a player only as a band', async () => {
  const { s, at, id } = await fight();
  await send(s.master, at('Goblin 2', '/hp'), 'POST', { operation: 'damage', amount: 4 });

  const [master] = combatEvents(await feed(s, s.master), 'combat.damage');
  assert.deepEqual(master?.payload, {
    kind: 'combat.damage',
    encounterId: master!.payload.kind === 'combat.damage' ? master!.payload.encounterId : '',
    combatantId: id('Goblin 2'),
    name: 'Goblin 2',
    source: 'statblock',
    amount: 4,
    hpCurrent: 3,
    hpMax: 7,
    band: 'bloodied',
  });
  assert.equal(master!.userName, 'Lia Martins');

  const [player] = combatEvents(await feed(s, s.player), 'combat.damage');
  assert.equal(player?.id, master!.id);
  const payload = player!.payload as Record<string, unknown>;
  assert.equal(payload.band, 'bloodied');
  for (const key of ['amount', 'hpCurrent', 'hpMax']) assert.equal(key in payload, false, key);
});

test('the hit that takes a monster down is told once, as its defeat', async () => {
  const { s, at } = await fight();
  await send(s.master, at('Goblin 2', '/hp'), 'POST', { operation: 'damage', amount: 30 });

  const events = await feed(s, s.master);
  assert.equal(combatEvents(events, 'combat.damage').length, 0);
  const [defeated] = combatEvents(events, 'combat.defeated');
  assert.deepEqual(defeated && { ...defeated.payload, encounterId: '', combatantId: '' }, {
    kind: 'combat.defeated',
    encounterId: '',
    combatantId: '',
    name: 'Goblin 2',
    source: 'statblock',
    amount: 30,
    hpCurrent: 0,
    hpMax: 7,
    band: 'defeated',
  });
  const [player] = combatEvents(await feed(s, s.player), 'combat.defeated');
  assert.equal('amount' in player!.payload, false);
});

test("a character's hit points stay open to the table, and healing is told too", async () => {
  const { s, at } = await fight();
  await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 5 });
  await send(s.otherPlayer, at('Mira', '/hp'), 'POST', { operation: 'damage', amount: 2 });
  await send(s.otherPlayer, at('Mira', '/hp'), 'POST', { operation: 'heal', amount: 1 });

  const events = await feed(s, s.player);
  const [damage] = combatEvents(events, 'combat.damage');
  assert.equal(damage?.payload.kind === 'combat.damage' && damage.payload.amount, 5);
  const [heal] = combatEvents(events, 'combat.heal');
  assert.deepEqual(heal?.payload.kind === 'combat.heal' && [heal.payload.name, heal.payload.amount, heal.payload.hpCurrent], ['Mira', 1, 23]);
});

test('only the hit that takes a character down is told as a fall', async () => {
  const { s, at } = await fight();
  await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 24 });
  await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 5 });

  const falls = combatEvents(await feed(s, s.player), 'combat.damage').map((event) =>
    event.payload.kind === 'combat.damage' ? [event.payload.amount, event.payload.hpCurrent, event.payload.fell] : null,
  );
  assert.deepEqual(falls, [
    [24, 0, true],
    [5, 0, undefined],
  ]);
});

test('temporary hit points and concentration stay out of the feed', async () => {
  const { s, at } = await fight();
  const before = (await feed(s, s.master)).length;
  await send(s.player, at('Kaelen', '/hp'), 'POST', { operation: 'temp', amount: 5 });
  await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true });
  assert.equal((await feed(s, s.master)).length, before);
});

test("a hidden combatant's events are the master's secret, even after it is revealed", async () => {
  const { s, at } = await fight();
  await send(s.master, at('Bandido', '/hp'), 'POST', { operation: 'damage', amount: 2 });
  await send(s.master, at('Bandido', '/conditions/prone'), 'PUT', {});
  await send(s.master, at('Bandido'), 'PATCH', { hidden: false });

  const master = (await feed(s, s.master)).filter((event) => event.type.startsWith('combat.') && JSON.stringify(event.payload).includes('Bandido'));
  assert.equal(master.length, 2);
  assert.ok(master.every((event) => event.secret));
  const player = await feed(s, s.player);
  assert.equal(JSON.stringify(player).includes('Bandido'), false);
});

test('applying, removing and the end of a duration are told', async () => {
  const { s, at, path, id } = await fight();
  await send(s.player, at('Kaelen', '/conditions/poisoned'), 'PUT', { roundsLeft: 2 });
  await send(s.player, at('Kaelen', '/conditions/poisoned'), 'DELETE');
  await send(s.master, at('Goblin 1', '/conditions/prone'), 'PUT', { roundsLeft: 1 });
  // Goblin 1 acts first: the end of its turn runs its durations out.
  await advance(s.master, path, id('Goblin 1'));

  const conditions = combatEvents(await feed(s, s.player), 'combat.condition').map((event) =>
    event.payload.kind === 'combat.condition' ? [event.payload.name, event.payload.action, event.payload.condition] : null,
  );
  assert.deepEqual(conditions, [
    ['Kaelen', 'applied', { condition: 'poisoned', roundsLeft: 2 }],
    ['Kaelen', 'removed', { condition: 'poisoned', roundsLeft: 2 }],
    ['Goblin 1', 'applied', { condition: 'prone', roundsLeft: 1 }],
    ['Goblin 1', 'expired', { condition: 'prone', roundsLeft: 1 }],
  ]);
});

test('a death save rolled and failures recorded are told with the count', async (t) => {
  const { s, at } = await fight();
  await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 24 });
  t.mock.method(Math, 'random', () => 0.3); // 7: a failure
  await send(s.master, at('Kaelen', '/death-save'), 'POST');
  await send(s.master, at('Kaelen', '/death-save'), 'POST', { failures: 2 });

  const saves = combatEvents(await feed(s, s.player), 'combat.deathSave').map((event) =>
    event.payload.kind === 'combat.deathSave'
      ? { d20: event.payload.d20, failures: event.payload.failures, saves: event.payload.saves, outcome: event.payload.outcome }
      : null,
  );
  assert.deepEqual(saves, [
    { d20: 7, failures: undefined, saves: { successes: 0, failures: 1 }, outcome: 'pending' },
    { d20: undefined, failures: 2, saves: { successes: 0, failures: 3 }, outcome: 'dead' },
  ]);
});

test("a player's socket gets the band of a monster's damage, never the number", async (t) => {
  const server = await createTestServer(PROFILES);
  const s = await setup({ app: server.app, db: server.db });
  const socket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(async () => {
    socket.close();
    await server.close();
  });
  await new Promise((resolve) => socket.once('open', resolve));
  const { at } = await fight(s);
  const events: SessionEvent[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'session.event') events.push(message.event);
  });

  await send(s.master, at('Goblin 2', '/hp'), 'POST', { operation: 'damage', amount: 4 });
  await send(s.master, at('Bandido', '/hp'), 'POST', { operation: 'damage', amount: 4 });
  await until(() => events.some((event) => event.type === 'combat.damage'));
  await new Promise((resolve) => setTimeout(resolve, 50));

  const damage = events.filter((event) => event.type === 'combat.damage');
  assert.equal(damage.length, 1);
  assert.equal(JSON.stringify(damage).includes('"amount"'), false);
  assert.equal(JSON.stringify(events).includes('Bandido'), false);
});
