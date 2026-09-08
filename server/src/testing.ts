import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { schema, type Db } from '@quest-fast/db';
import { createApp } from './app.ts';
import { DiscordFailure, type DiscordClient, type DiscordProfile } from './auth/discord.ts';
import { SESSION_COOKIE, STATE_COOKIE } from './auth/session.ts';
import type { Env } from './env.ts';

const MIGRATIONS = resolve(import.meta.dirname, '../../db/migrations');

/** In-memory database with the real schema applied by versioned migrations. */
export function createTestDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

export const testEnv: Env = {
  port: 0,
  dbFile: ':memory:',
  clientDir: './unused',
  discordClientId: 'test-id',
  discordClientSecret: 'test-secret',
  discordRedirectUri: 'http://localhost/api/auth/discord/callback',
  secureCookie: false,
};

/**
 * Fake Discord: the test picks which profile a code returns, with no network
 * and no credentials. An unknown code simulates the provider refusing.
 */
export function createFakeDiscord(profiles: Record<string, DiscordProfile>): DiscordClient {
  return {
    authorizationUrl: (state) => `https://discord.test/authorize?state=${state}`,
    async exchangeCodeForProfile(code) {
      const profile = profiles[code];
      if (!profile) throw new DiscordFailure('unknown code');
      return profile;
    },
  };
}

export type TestApp = ReturnType<typeof createTestApp>;

export function createTestApp(profiles: Record<string, DiscordProfile>) {
  const db = createTestDb();
  const app = createApp({ db, env: testEnv, discord: createFakeDiscord(profiles), serveClient: false });
  return { db, app };
}

function cookieFromResponse(response: Response, name: string): string | undefined {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const [key, value] = pair.split('=');
    if (key === name && value) return value;
  }
  return undefined;
}

/**
 * Walks the real OAuth flow — start, `state` and callback — and returns the
 * session cookie. Authenticating by shortcut would hide defects in the flow.
 */
export async function signIn(app: TestApp, code: string): Promise<string> {
  const start = await app.app.request('/api/auth/discord');
  const state = cookieFromResponse(start, STATE_COOKIE);
  if (!state) throw new Error('login flow did not emit the state cookie');

  const callback = await app.app.request(`/api/auth/discord/callback?code=${code}&state=${state}`, {
    headers: { cookie: `${STATE_COOKIE}=${state}` },
  });
  const session = cookieFromResponse(callback, SESSION_COOKIE);
  if (!session) throw new Error(`login failed for code ${code}`);
  return session;
}

/** Authenticated request as the owner of the session cookie. */
export function asUser(app: TestApp, session: string) {
  return (path: string, init: RequestInit = {}) =>
    app.app.request(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
        cookie: `${SESSION_COOKIE}=${session}`,
      },
    });
}

/** `Response.json()` returns `unknown`; the test declares the expected shape. */
export async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
