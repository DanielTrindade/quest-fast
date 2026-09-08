/**
 * Server environment variables. The app does not start without the Discord
 * credentials: that is the operational prerequisite stated in the proposal.
 */
export type Env = {
  port: number;
  dbFile: string | undefined;
  /** Directory of the client build served in production. */
  clientDir: string;
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  /** `Secure` cookies require HTTPS; off for local development. */
  secureCookie: boolean;
};

export class InvalidEnv extends Error {}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new InvalidEnv(
      `Environment variable ${name} is not set. See .env.example and the README to register the application on the Discord Developer Portal.`,
    );
  }
  return value;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new InvalidEnv(`Invalid PORT: ${source.PORT}`);
  }
  return {
    port,
    dbFile: source.DB_FILE?.trim() || undefined,
    clientDir: source.CLIENT_DIR?.trim() || 'client/dist',
    discordClientId: required(source, 'DISCORD_CLIENT_ID'),
    discordClientSecret: required(source, 'DISCORD_CLIENT_SECRET'),
    discordRedirectUri: required(source, 'DISCORD_REDIRECT_URI'),
    secureCookie:
      (source.COOKIE_SECURE ?? (source.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  };
}
