import type { R2Config } from './assets/store.ts';

/**
 * Server environment variables. The app does not start without the Discord
 * credentials: that is the documented self-host prerequisite.
 */
export type Env = {
  port: number;
  dbFile: string | undefined;
  /** Directory of the client build served in production. */
  clientDir: string;
  /**
   * Directory where uploaded assets are stored; absolute or relative to the
   * repo root. Still served under /uploads when R2 is on, for files saved
   * before the switch.
   */
  uploadsDir: string;
  /** Present when ASSET_STORAGE=r2: new uploads go to that bucket. */
  r2: R2Config | undefined;
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

const R2_VARIABLES = {
  accountId: 'R2_ACCOUNT_ID',
  accessKeyId: 'R2_ACCESS_KEY_ID',
  secretAccessKey: 'R2_SECRET_ACCESS_KEY',
  bucket: 'R2_BUCKET',
  publicUrl: 'R2_PUBLIC_URL',
} as const;

/** Disk unless ASSET_STORAGE=r2; then every R2 variable is required. */
function readR2(source: NodeJS.ProcessEnv): R2Config | undefined {
  const storage = source.ASSET_STORAGE?.trim() || 'disk';
  if (storage === 'disk') return undefined;
  if (storage !== 'r2') {
    throw new InvalidEnv(`Invalid ASSET_STORAGE: ${storage}. Use disk or r2.`);
  }
  const missing = Object.values(R2_VARIABLES).filter((name) => !source[name]?.trim());
  if (missing.length > 0) {
    throw new InvalidEnv(`ASSET_STORAGE=r2 requires ${missing.join(', ')}. See .env.example and the README.`);
  }
  const value = (key: keyof typeof R2_VARIABLES) => source[R2_VARIABLES[key]]!.trim();
  // Avatar URLs are this base plus the path: it must be an absolute http(s)
  // URL, and a trailing slash would double the one the path adds.
  const publicUrl = value('publicUrl').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]/.test(publicUrl) || !URL.canParse(publicUrl)) {
    throw new InvalidEnv(`Invalid R2_PUBLIC_URL: ${source.R2_PUBLIC_URL}. Use the bucket's public URL, e.g. https://cdn.example.com.`);
  }
  return {
    accountId: value('accountId'),
    accessKeyId: value('accessKeyId'),
    secretAccessKey: value('secretAccessKey'),
    bucket: value('bucket'),
    publicUrl,
  };
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
    uploadsDir: source.UPLOADS_DIR?.trim() || 'uploads',
    r2: readR2(source),
    discordClientId: required(source, 'DISCORD_CLIENT_ID'),
    discordClientSecret: required(source, 'DISCORD_CLIENT_SECRET'),
    discordRedirectUri: required(source, 'DISCORD_REDIRECT_URI'),
    secureCookie:
      (source.COOKIE_SECURE ?? (source.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  };
}
