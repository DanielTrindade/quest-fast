import { randomUUID } from 'node:crypto';
import { loginFailurePath, safeReturnPath } from '@quest-fast/shared';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from '../context.ts';
import { DiscordFailure } from './discord.ts';
import {
  NEXT_COOKIE,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  STATE_COOKIE,
  createSession,
  destroySession,
  upsertDiscordUser,
} from './session.ts';

/** Where the browser lands after Discord. */
const AFTER_LOGIN = '/campaigns';

export function authRoutes() {
  const routes = new Hono<Context>();

  routes.get('/discord', (c) => {
    const { discord, env } = c.var.deps;
    // `state` ties the callback to this browser and blocks login CSRF.
    const state = randomUUID();
    setCookie(c, STATE_COOKIE, state, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.secureCookie,
      maxAge: 600,
    });
    const next = safeReturnPath(c.req.query('next'));
    if (next) {
      setCookie(c, NEXT_COOKIE, next, {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: env.secureCookie,
        maxAge: 600,
      });
    } else {
      deleteCookie(c, NEXT_COOKIE, { path: '/' });
    }
    return c.redirect(discord.authorizationUrl(state));
  });

  routes.get('/discord/callback', async (c) => {
    const { db, discord, env } = c.var.deps;
    const expectedState = getCookie(c, STATE_COOKIE);
    const next = safeReturnPath(getCookie(c, NEXT_COOKIE));
    deleteCookie(c, STATE_COOKIE, { path: '/' });
    deleteCookie(c, NEXT_COOKIE, { path: '/' });
    const failure = loginFailurePath(next);

    const code = c.req.query('code');
    const state = c.req.query('state');

    // Discord returns `error=access_denied` when the user declines.
    if (c.req.query('error') || !code) return c.redirect(failure);
    if (!state || !expectedState || state !== expectedState) return c.redirect(failure);

    let profile;
    try {
      profile = await discord.exchangeCodeForProfile(code);
    } catch (error) {
      if (error instanceof DiscordFailure) return c.redirect(failure);
      throw error;
    }

    const user = upsertDiscordUser(db, profile);
    const session = createSession(db, user.id);
    setCookie(c, SESSION_COOKIE, session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.secureCookie,
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return c.redirect(next ?? AFTER_LOGIN);
  });

  routes.post('/logout', (c) => {
    const { db } = c.var.deps;
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) destroySession(db, sessionId);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  return routes;
}
