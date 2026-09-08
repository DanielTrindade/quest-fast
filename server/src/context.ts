import type { Db, UserRow } from '@quest-fast/db';
import type { Role } from '@quest-fast/shared';
import type { DiscordClient } from './auth/discord.ts';
import type { Env } from './env.ts';

export type Deps = {
  db: Db;
  env: Env;
  discord: DiscordClient;
};

/**
 * Hono context variables. `user` is set by `requireAuth` and `role` by
 * `requireCampaignRole`; no route reads them without the middleware.
 */
export type Context = {
  Variables: {
    deps: Deps;
    user: UserRow;
    role: Role;
    campaignId: string;
  };
};
