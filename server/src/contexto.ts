import type { Db, User } from '@quest-fast/db';
import type { Papel } from '@quest-fast/shared';
import type { ClienteDiscord } from './auth/discord.ts';
import type { Env } from './env.ts';

export type Deps = {
  db: Db;
  env: Env;
  discord: ClienteDiscord;
};

/**
 * Variáveis do contexto do Hono. `usuario` é posto por `requireAuth` e
 * `papel` por `requireCampaignRole`; nenhuma rota os lê sem o middleware.
 */
export type Contexto = {
  Variables: {
    deps: Deps;
    usuario: User;
    papel: Papel;
    campanhaId: string;
  };
};
