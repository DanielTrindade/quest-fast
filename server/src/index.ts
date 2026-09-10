import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createDb } from '@quest-fast/db';
import { createApp } from './app.ts';
import { createDiscordClient } from './auth/discord.ts';
import { deleteExpiredSessions } from './auth/session.ts';
import { createDiskAssetStore } from './assets/store.ts';
import { InvalidEnv, readEnv } from './env.ts';
import { createEventHub } from './events/hub.ts';
import { attachWebSocket } from './events/ws.ts';

try {
  const env = readEnv();
  const db = createDb(env.dbFile);
  deleteExpiredSessions(db);

  const discord = createDiscordClient({
    clientId: env.discordClientId,
    clientSecret: env.discordClientSecret,
    redirectUri: env.discordRedirectUri,
  });

  const hub = createEventHub();
  const app = createApp({ db, env, discord, hub, assets: createDiskAssetStore(env.uploadsDir) });

  // One HTTP server carries REST, the SPA and the WebSocket — the upgrade
  // belongs to us, so the listener is built with getRequestListener (serve()
  // would attach its own upgrade handling).
  const server = createServer(getRequestListener(app.fetch));
  server.listen(env.port, () => {
    console.log(`quest-fast on http://localhost:${env.port}`);
  });
  attachWebSocket(server, { db, hub });
} catch (error) {
  if (error instanceof InvalidEnv) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
