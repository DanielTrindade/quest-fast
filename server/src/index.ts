import { serve } from '@hono/node-server';
import { createDb } from '@quest-fast/db';
import { createApp } from './app.ts';
import { createDiscordClient } from './auth/discord.ts';
import { deleteExpiredSessions } from './auth/session.ts';
import { InvalidEnv, readEnv } from './env.ts';

try {
  const env = readEnv();
  const db = createDb(env.dbFile);
  deleteExpiredSessions(db);

  const discord = createDiscordClient({
    clientId: env.discordClientId,
    clientSecret: env.discordClientSecret,
    redirectUri: env.discordRedirectUri,
  });

  const app = createApp({ db, env, discord });

  serve({ fetch: app.fetch, port: env.port }, (info) => {
    console.log(`quest-fast on http://localhost:${info.port}`);
  });
} catch (error) {
  if (error instanceof InvalidEnv) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
