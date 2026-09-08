/**
 * Variáveis de ambiente do servidor. O app não sobe sem as credenciais do
 * Discord: é o pré-requisito operacional declarado na proposal.
 */
export type Env = {
  porta: number;
  dbFile: string | undefined;
  /** Diretório do build do client servido em produção. */
  clientDir: string;
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  /** Cookies com `Secure` exigem HTTPS; desligado no desenvolvimento local. */
  cookieSeguro: boolean;
};

export class EnvInvalido extends Error {}

function obrigatoria(fonte: NodeJS.ProcessEnv, nome: string): string {
  const valor = fonte[nome]?.trim();
  if (!valor) {
    throw new EnvInvalido(
      `Variável de ambiente ${nome} não definida. Veja .env.example e o README para registrar a aplicação no Discord Developer Portal.`,
    );
  }
  return valor;
}

export function lerEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  const porta = Number(fonte.PORT ?? 3000);
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
    throw new EnvInvalido(`PORT inválida: ${fonte.PORT}`);
  }
  return {
    porta,
    dbFile: fonte.DB_FILE?.trim() || undefined,
    clientDir: fonte.CLIENT_DIR?.trim() || '../client/dist',
    discordClientId: obrigatoria(fonte, 'DISCORD_CLIENT_ID'),
    discordClientSecret: obrigatoria(fonte, 'DISCORD_CLIENT_SECRET'),
    discordRedirectUri: obrigatoria(fonte, 'DISCORD_REDIRECT_URI'),
    cookieSeguro: (fonte.COOKIE_SECURE ?? (fonte.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  };
}
