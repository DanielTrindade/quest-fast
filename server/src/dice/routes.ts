import { Hono } from 'hono';
import type { FreeRollRequest, RollMode, RollPayload } from '@quest-fast/shared';
import { isRollMode, rollDice } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { recordRollEvent } from '../events/feed.ts';

/**
 * Free roll: the client sends an expression, the server rolls and publishes.
 * No result sent by the client is ever trusted — the server is the source of
 * truth for dice (design decision 4).
 */
export function diceRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth);

  routes.post('/', requireCampaignRole(), async (c) => {
    const { db, hub } = c.var.deps;
    const body = (await c.req.json().catch(() => ({}))) as FreeRollRequest;

    const expression = typeof body?.expression === 'string' ? body.expression.trim() : '';

    // An unknown mode is a malformed request, not "normal": silently rolling
    // without the requested advantage would hide the client's bug.
    const rawMode = body?.mode;
    if (rawMode !== undefined && !isRollMode(rawMode)) {
      return c.json({ error: 'Modo de rolagem inválido.' }, 422);
    }
    const mode: RollMode = rawMode ?? 'normal';

    const result = rollDice(expression, mode);
    if (!result) {
      const message =
        mode !== 'normal' && expression !== '1d20'
          ? 'Vantagem e desvantagem valem apenas para um d20 (1d20 ou 1d20+modificador).'
          : 'Expressão de dados inválida. Use o formato 1d20+5, 2d6+3, etc.';
      return c.json({ error: message }, 422);
    }

    const secret = body?.secret === true;
    if (secret && c.var.role !== 'master') {
      return c.json({ error: 'Apenas o mestre pode rolar em segredo.' }, 403);
    }

    const payload: RollPayload = { kind: 'roll', ...result };
    const event = recordRollEvent(db, {
      campaignId: c.var.campaignId,
      userId: c.var.user.id,
      userName: c.var.user.name,
      secret,
      payload,
    });
    hub.publish(c.var.campaignId, event);
    return c.json({ event }, 201);
  });

  return routes;
}