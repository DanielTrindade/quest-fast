import { Hono } from 'hono';
import { CHAT_LIMITS, validateChatBody } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { createAttemptLimiter, type AttemptLimiterOptions } from '../invites/attempt-limiter.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { readChat, removeMessage, sendMessage } from './store.ts';

/**
 * The table chat: talk among the members, apart from the game. Nothing here
 * rolls or changes the game, and nothing reaches `session_events`. Every
 * member reads the same messages; a non-member gets the campaign's 404.
 */
export function chatRoutes(rate: AttemptLimiterOptions = {}) {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth);
  // The invite limiter's design, counting accepted messages instead of failures.
  const sent = createAttemptLimiter({ limit: CHAT_LIMITS.rateLimit, windowMs: CHAT_LIMITS.rateWindowMs, ...rate });

  routes.get('/', requireCampaignRole(), (c) => {
    const { db, assets } = c.var.deps;
    return c.json(readChat(db, assets, c.var.campaignId, c.req.query('cursor') || undefined));
  });

  routes.post('/', requireCampaignRole(), async (c) => {
    const { db, assets, hub } = c.var.deps;
    // The body is read first: from the budget check to its use there is no
    // await, so concurrent requests are admitted one at a time and never all
    // pass the same check before any of them counts.
    const request = (await c.req.json().catch(() => null)) as { body?: unknown; replyToId?: unknown } | null;
    const key = `${c.var.campaignId}:${c.var.user.id}`;
    const wait = sent.retryAfter([key]);
    if (wait > 0) {
      c.header('Retry-After', String(wait));
      return c.json({ error: 'Calma: espere um instante antes da próxima mensagem.' }, 429);
    }

    const valid = validateChatBody(request?.body);
    if ('error' in valid) return c.json({ error: valid.error }, 422);
    const replyToId = request?.replyToId;
    if (replyToId !== undefined && replyToId !== null && typeof replyToId !== 'string') {
      return c.json({ error: 'Resposta inválida.' }, 422);
    }

    const outcome = sendMessage(db, assets, {
      campaignId: c.var.campaignId,
      userId: c.var.user.id,
      body: valid.body,
      ...(typeof replyToId === 'string' ? { replyToId } : {}),
    });
    if ('error' in outcome) return c.json({ error: outcome.error }, 422);

    sent.fail([key]);
    hub.publishChat(c.var.campaignId, outcome.message);
    return c.json({ message: outcome.message }, 201);
  });

  routes.delete('/:messageId', requireCampaignRole(), (c) => {
    const { db, hub } = c.var.deps;
    const messageId = c.req.param('messageId');
    const outcome = removeMessage(db, {
      campaignId: c.var.campaignId,
      messageId,
      userId: c.var.user.id,
      master: c.var.role === 'master',
    });
    if (outcome === 'not-found') return c.json({ error: 'Mensagem não encontrada.' }, 404);
    // A member sees the message, so its existence is no secret: 403, not 404.
    if (outcome === 'forbidden') return c.json({ error: 'Só quem escreveu ou o mestre removem a mensagem.' }, 403);
    hub.publishChatRemoved(c.var.campaignId, messageId);
    return c.body(null, 204);
  });

  return routes;
}
