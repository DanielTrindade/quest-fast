import type { HttpBindings } from '@hono/node-server';
import type { Db, UserRow } from '@quest-fast/db';
import type { Role } from '@quest-fast/shared';
import type { DiscordClient } from './auth/discord.ts';
import type { AssetStore } from './assets/store.ts';
import type { Env } from './env.ts';
import type { EventHub } from './events/hub.ts';
import type { TokenLocks } from './scenes/locks.ts';

export type Deps = {
  db: Db;
  env: Env;
  discord: DiscordClient;
  hub: EventHub;
  assets: AssetStore;
  /** Who is dragging which token; in memory, like the hub. */
  locks: TokenLocks;
};

/**
 * Hono context variables. `user` is set by `requireAuth` and `role` by
 * `requireCampaignRole`; no route reads them without the middleware.
 */
export type Context = {
  /** Absent under `app.request`, which is how the integration tests call. */
  Bindings: Partial<HttpBindings>;
  Variables: {
    deps: Deps;
    user: UserRow;
    viewer?: UserRow;
    role: Role;
    campaignId: string;
  };
};
