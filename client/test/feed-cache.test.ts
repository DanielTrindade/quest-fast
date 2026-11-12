import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import type { FeedResponse, RollSessionEvent } from '@quest-fast/shared';
import { mergeFeedEvent } from '../src/lib/feed-cache.ts';

const CAMPAIGN = 'c1';

function roll(id: string, payload: Partial<RollSessionEvent['payload']>): RollSessionEvent {
  return {
    id,
    campaignId: CAMPAIGN,
    userId: 'u1',
    userName: 'Rafael Costa',
    type: 'roll',
    secret: false,
    payload: { kind: 'roll', expression: '1d20+5', dice: [{ value: 12, sides: 20 }], modifier: 5, total: 17, mode: 'normal', ...payload },
    createdAt: '2026-11-12T00:00:00.000Z',
  };
}

const attack = roll('a1', { rollKind: 'attack', attackName: 'Espada longa', damageRollable: { expression: '1d8+3', damageType: 'Cortante' } });
const damage = roll('d1', { rollKind: 'attack', attackName: 'Espada longa', damageOf: 'a1' });

function feedOf(queryClient: QueryClient): RollSessionEvent[] {
  return queryClient.getQueryData<FeedResponse>(['feed', CAMPAIGN])!.events as RollSessionEvent[];
}

test('a damage rolled after its attack settles the attack in the feed', () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData<FeedResponse>(['feed', CAMPAIGN], { events: [attack], nextCursor: null });

  mergeFeedEvent(queryClient, CAMPAIGN, damage);
  const [settled, rolled] = feedOf(queryClient);
  assert.equal(settled?.payload.damageRolled, true);
  assert.equal(rolled?.id, 'd1');
});

test('the same damage arriving twice, from the answer and the socket, is merged once', () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData<FeedResponse>(['feed', CAMPAIGN], { events: [attack], nextCursor: null });

  mergeFeedEvent(queryClient, CAMPAIGN, damage);
  mergeFeedEvent(queryClient, CAMPAIGN, damage);
  assert.equal(feedOf(queryClient).length, 2);
});

test('any other roll leaves the attacks alone', () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData<FeedResponse>(['feed', CAMPAIGN], { events: [attack], nextCursor: null });

  mergeFeedEvent(queryClient, CAMPAIGN, roll('r1', {}));
  assert.equal(feedOf(queryClient)[0]?.payload.damageRolled, undefined);
});
