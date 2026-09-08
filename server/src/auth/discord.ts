/**
 * Cliente do OAuth do Discord. O `fetch` é injetável para que os testes
 * exercitem o fluxo inteiro sem rede e sem credenciais reais.
 */

export type PerfilDiscord = {
  discordId: string;
  nome: string;
  avatarUrl: string | null;
};

export type ClienteDiscord = {
  urlDeAutorizacao(state: string): string;
  trocarCodigoPorPerfil(codigo: string): Promise<PerfilDiscord>;
};

export class FalhaNoDiscord extends Error {}

const AUTORIZACAO = 'https://discord.com/oauth2/authorize';
const TOKEN = 'https://discord.com/api/oauth2/token';
const USUARIO = 'https://discord.com/api/users/@me';

/** Só precisamos da identidade: nome e avatar. Nada de servidores ou e-mail. */
const ESCOPO = 'identify';

type Config = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
};

/**
 * O Discord entrega `avatar` como hash. Sem avatar, cai no padrão derivado do
 * id — assim a lista de membros nunca fica com um espaço vazio.
 */
export function montarAvatarUrl(discordId: string, hash: string | null | undefined): string | null {
  if (!hash) return null;
  const extensao = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.${extensao}`;
}

export function criarClienteDiscord({ clientId, clientSecret, redirectUri, fetchImpl = fetch }: Config): ClienteDiscord {
  return {
    urlDeAutorizacao(state) {
      const url = new URL(AUTORIZACAO);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', ESCOPO);
      url.searchParams.set('state', state);
      url.searchParams.set('prompt', 'none');
      return url.toString();
    },

    async trocarCodigoPorPerfil(codigo) {
      const corpo = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: codigo,
        redirect_uri: redirectUri,
      });

      const respostaToken = await fetchImpl(TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: corpo,
      });
      if (!respostaToken.ok) {
        throw new FalhaNoDiscord(`Troca de código recusada pelo Discord (${respostaToken.status}).`);
      }
      const token = (await respostaToken.json()) as { access_token?: string };
      if (!token.access_token) throw new FalhaNoDiscord('Discord não devolveu access_token.');

      const respostaUsuario = await fetchImpl(USUARIO, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!respostaUsuario.ok) {
        throw new FalhaNoDiscord(`Leitura do perfil recusada pelo Discord (${respostaUsuario.status}).`);
      }
      const perfil = (await respostaUsuario.json()) as {
        id?: string;
        username?: string;
        global_name?: string | null;
        avatar?: string | null;
      };
      if (!perfil.id) throw new FalhaNoDiscord('Perfil do Discord veio sem id.');

      return {
        discordId: perfil.id,
        nome: perfil.global_name?.trim() || perfil.username?.trim() || 'Aventureiro sem nome',
        avatarUrl: montarAvatarUrl(perfil.id, perfil.avatar),
      };
    },
  };
}
