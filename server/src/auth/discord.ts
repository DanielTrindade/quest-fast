/**
 * Discord OAuth client. `fetch` is injectable so tests can exercise the whole
 * flow without the network and without real credentials.
 */

export type DiscordProfile = {
  discordId: string;
  name: string;
  avatarUrl: string | null;
};

export type DiscordClient = {
  authorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<DiscordProfile>;
};

export class DiscordFailure extends Error {}

const AUTHORIZE = 'https://discord.com/oauth2/authorize';
const TOKEN = 'https://discord.com/api/oauth2/token';
const USER = 'https://discord.com/api/users/@me';

/** We only need identity: name and avatar. No guilds, no email. */
const SCOPE = 'identify';

type Config = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
};

/**
 * Discord returns `avatar` as a hash. Without an avatar it falls back to null,
 * and the component renders initials instead of an empty slot.
 */
export function buildAvatarUrl(discordId: string, hash: string | null | undefined): string | null {
  if (!hash) return null;
  const extension = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.${extension}`;
}

export function createDiscordClient({
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
}: Config): DiscordClient {
  return {
    authorizationUrl(state) {
      const url = new URL(AUTHORIZE);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', SCOPE);
      url.searchParams.set('state', state);
      url.searchParams.set('prompt', 'none');
      return url.toString();
    },

    async exchangeCodeForProfile(code) {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const tokenResponse = await fetchImpl(TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!tokenResponse.ok) {
        throw new DiscordFailure(`Discord refused the code exchange (${tokenResponse.status}).`);
      }
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!token.access_token) throw new DiscordFailure('Discord returned no access_token.');

      const userResponse = await fetchImpl(USER, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!userResponse.ok) {
        throw new DiscordFailure(`Discord refused the profile read (${userResponse.status}).`);
      }
      const profile = (await userResponse.json()) as {
        id?: string;
        username?: string;
        global_name?: string | null;
        avatar?: string | null;
      };
      if (!profile.id) throw new DiscordFailure('Discord profile came back without an id.');

      return {
        discordId: profile.id,
        // Fallback name is player-facing text, so it stays in Portuguese.
        name: profile.global_name?.trim() || profile.username?.trim() || 'Aventureiro sem nome',
        avatarUrl: buildAvatarUrl(profile.id, profile.avatar),
      };
    },
  };
}
