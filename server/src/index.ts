import { serve } from '@hono/node-server';
import { criarDb } from '@quest-fast/db';
import { criarApp } from './app.ts';
import { criarClienteDiscord } from './auth/discord.ts';
import { limparSessoesExpiradas } from './auth/session.ts';
import { EnvInvalido, lerEnv } from './env.ts';

try {
  const env = lerEnv();
  const db = criarDb(env.dbFile);
  limparSessoesExpiradas(db);

  const discord = criarClienteDiscord({
    clientId: env.discordClientId,
    clientSecret: env.discordClientSecret,
    redirectUri: env.discordRedirectUri,
  });

  const app = criarApp({ db, env, discord });

  serve({ fetch: app.fetch, port: env.porta }, (info) => {
    console.log(`quest-fast em http://localhost:${info.port}`);
  });
} catch (erro) {
  if (erro instanceof EnvInvalido) {
    console.error(erro.message);
    process.exit(1);
  }
  throw erro;
}
