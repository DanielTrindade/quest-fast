import assert from 'node:assert/strict';
import WebSocket from 'ws';
import type {
  CharacterResponse,
  CombatantView,
  CreatedCampaign,
  EncounterResponse,
  EncounterView,
  SocketMessage,
  StatblockResponse,
} from '@quest-fast/shared';
import { SESSION_COOKIE } from '../auth/session.ts';
import { asUser, body, createTestApp, signIn, type TestApp } from '../testing.ts';

/** What the combat integration tests share: a campaign with two players, and an encounter ready to run. */
export const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  bia: { discordId: '333', name: 'Bia Souza', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

export const GOBLIN = {
  name: 'Goblin',
  size: 'small',
  ac: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  initiativeBonus: 0,
  abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
  attacks: [{ name: 'Cimitarra', bonus: 4, damage: '1d6+2' }],
};

export function sheet(name: string) {
  return {
    name,
    race: 'Elfo',
    class: 'Ladino',
    level: 3,
    abilityScores: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 12, charisma: 8 },
    hp: 24,
    ac: 15,
    skills: [],
    saves: [],
    attacks: [],
    features: [],
    description: '',
  };
}

export type Request = ReturnType<typeof asUser>;

export function send(request: Request, path: string, method: string, payload: unknown = {}) {
  return request(path, { method, body: JSON.stringify(payload) });
}

export async function setup(app: Pick<TestApp, 'app' | 'db'> = createTestApp(PROFILES)) {
  const master = asUser(app, await signIn(app, 'lia'));
  const player = asUser(app, await signIn(app, 'rafael'));
  const otherPlayer = asUser(app, await signIn(app, 'bia'));
  const outsider = asUser(app, await signIn(app, 'outsider'));
  const campaign = await body<CreatedCampaign>(
    await send(master, '/api/campaigns', 'POST', { name: 'Ecos de Phandalin' }),
  );
  for (const member of [player, otherPlayer]) {
    await send(member, '/api/campaigns/join', 'POST', { code: campaign.inviteCode });
  }
  const root = `/api/campaigns/${campaign.id}`;
  const kaelen = (await body<CharacterResponse>(await send(player, `${root}/characters`, 'POST', sheet('Kaelen')))).character;
  const mira = (await body<CharacterResponse>(await send(otherPlayer, `${root}/characters`, 'POST', sheet('Mira')))).character;
  const goblin = (await body<StatblockResponse>(await send(master, `${root}/statblocks`, 'POST', GOBLIN))).statblock;
  return { app, master, player, otherPlayer, outsider, campaign, root, base: `${root}/encounters`, kaelen, mira, goblin };
}

export type Setup = Awaited<ReturnType<typeof setup>>;

export async function encounterOf(response: Response, status = 200): Promise<EncounterView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<EncounterResponse>(response)).encounter;
}

export async function createEncounter(s: Setup, name = 'Emboscada na estrada') {
  return encounterOf(await send(s.master, s.base, 'POST', { name }), 201);
}

export function byName(encounter: EncounterView, name: string): CombatantView {
  const found = encounter.combatants.find((combatant) => combatant.name === name);
  assert.ok(found, `${name} is in the encounter`);
  return found;
}

/**
 * A ready encounter: Kaelen and Mira, two goblins and a hidden bandit, all
 * with known initiative so the queue is predictable — Goblin 1 (18), Kaelen
 * (15), Bandido (12, hidden), Goblin 2 (10), Mira (5).
 */
export async function runningEncounter(s: Setup, { start = true } = {}) {
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id });
  await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.mira.id });
  await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 2, hp: 'average' });
  let view = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', {
      source: 'manual',
      name: 'Bandido',
      ac: 12,
      hp: 11,
      hidden: true,
    }),
    201,
  );
  const values: Record<string, number> = { 'Goblin 1': 18, Kaelen: 15, Bandido: 12, 'Goblin 2': 10, Mira: 5 };
  for (const [name, value] of Object.entries(values)) {
    view = await encounterOf(await send(s.master, `${path}/combatants/${byName(view, name).id}/initiative`, 'POST', { value }));
  }
  if (start) {
    await encounterOf(await send(s.master, `${path}/start`, 'POST'));
    view = await encounterOf(await send(s.master, `${path}/turn`, 'POST', { direction: 'next', expectedActiveCombatantId: null, expectedRound: 0 }));
  }
  return { encounter: view, path, id: (name: string) => byName(view, name).id };
}

export async function advance(request: Request, path: string, expected: string | null, round = 1) {
  return send(request, `${path}/turn`, 'POST', { direction: 'next', expectedActiveCombatantId: expected, expectedRound: round });
}

export function connect(port: number, campaignId: string, session: string) {
  return new WebSocket(`ws://127.0.0.1:${port}/api/campaigns/${campaignId}/ws`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
  });
}

/** Every `combat.updated` a socket receives, in order. */
export function collectCombat(socket: WebSocket): EncounterView[] {
  const updates: EncounterView[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'combat.updated') updates.push(message.encounter);
  });
  return updates;
}

export async function until(check: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for the socket');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

