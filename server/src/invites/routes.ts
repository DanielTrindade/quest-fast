import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { campaignMembers } from '@quest-fast/db';
import type { InvitePreview } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { isBanned } from '../campaigns/bans.ts';
import { optionalAuth } from '../middleware.ts';
import { fetchAvatar, renderInviteCard } from './card.ts';
import { findInvite } from './invite-lookup.ts';
import { cardVersion } from './meta.ts';

const CARD_CACHE_LIMIT = 200;

export function inviteRoutes() {
  const routes = new Hono<Context>();
  const cardCache = new Map<string, Uint8Array>();
  const rendering = new Map<string, Promise<Uint8Array>>();

  routes.get('/:code/card.png', async (c) => {
    const invite = findInvite(c.var.deps.db, c.req.param('code'));
    if (!invite) return c.json({ error: 'Convite inválido.' }, 404);

    const version = cardVersion(invite);
    let png = cardCache.get(version);
    if (!png) {
      let pending = rendering.get(version);
      if (!pending) {
        pending = renderInviteCard({
          campaignName: invite.campaignName,
          masterName: invite.masterName,
          avatar: await fetchAvatar(invite.masterAvatarUrl),
        }).finally(() => rendering.delete(version));
        rendering.set(version, pending);
      }
      png = await pending;
      if (!cardCache.has(version)) {
        if (cardCache.size >= CARD_CACHE_LIMIT) cardCache.delete(cardCache.keys().next().value!);
        cardCache.set(version, png);
      }
    }
    return c.body(png as Uint8Array<ArrayBuffer>, 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
  });

  routes.get('/:code', optionalAuth, (c) => {
    const { db } = c.var.deps;
    const invite = findInvite(db, c.req.param('code'));
    if (!invite) return c.json({ error: 'Convite inválido.' }, 404);

    const viewer = c.var.viewer;
    let status: InvitePreview['viewer'] = 'anonymous';
    if (viewer) {
      const member = db
        .select({ id: campaignMembers.id })
        .from(campaignMembers)
        .where(and(eq(campaignMembers.campaignId, invite.campaignId), eq(campaignMembers.userId, viewer.id)))
        .get();
      if (member) status = 'member';
      else status = isBanned(db, invite.campaignId, viewer.id) ? 'blocked' : 'guest';
    }

    const preview: InvitePreview = {
      code: invite.code,
      campaignName: invite.campaignName,
      master: { name: invite.masterName, avatarUrl: invite.masterAvatarUrl },
      playerCount: invite.playerCount,
      viewer: status,
      ...(status === 'member' ? { campaignId: invite.campaignId } : {}),
    };
    return c.json(preview);
  });

  return routes;
}
