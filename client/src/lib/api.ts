import type {
  CampanhaCriada,
  CampanhaDetalhe,
  EntradaNaCampanha,
  RespostaCampanhas,
  RespostaMe,
  RespostaMembros,
} from '@quest-fast/shared';

/**
 * Cliente da API. O servidor é a fonte de verdade: aqui não há cálculo de
 * papel nem de visibilidade, apenas transporte e tradução de erro.
 */

export class ErroDaApi extends Error {
  // Campo declarado e atribuído no corpo: `erasableSyntaxOnly` proíbe
  // propriedades de parâmetro, que exigiriam transformação de tipo.
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }

  /** Sessão ausente ou expirada: o app deve voltar para a tela de login. */
  get naoAutenticado() {
    return this.status === 401;
  }
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

  if (!resposta.ok) {
    // Erro do servidor vem como { erro }. Uma falha de rede ou um HTML de
    // proxy não vêm, e não podem virar "undefined" na tela.
    const corpo = await resposta.json().catch(() => null);
    const mensagem =
      corpo && typeof corpo === 'object' && typeof (corpo as { erro?: unknown }).erro === 'string'
        ? (corpo as { erro: string }).erro
        : 'Não foi possível falar com o servidor.';
    throw new ErroDaApi(resposta.status, mensagem);
  }

  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

export const api = {
  me: () => pedir<RespostaMe>('/api/auth/me'),
  sair: () => pedir<void>('/api/auth/logout', { method: 'POST' }),

  campanhas: () => pedir<RespostaCampanhas>('/api/campanhas'),

  criarCampanha: (nome: string, descricao: string) =>
    pedir<CampanhaCriada>('/api/campanhas', {
      method: 'POST',
      body: JSON.stringify({ nome, descricao }),
    }),

  entrarNaCampanha: (codigo: string) =>
    pedir<EntradaNaCampanha>('/api/campanhas/entrar', {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    }),

  campanha: (id: string) => pedir<CampanhaDetalhe>(`/api/campanhas/${id}`),
  membros: (id: string) => pedir<RespostaMembros>(`/api/campanhas/${id}/membros`),

  sairDaCampanha: (id: string) => pedir<void>(`/api/campanhas/${id}/membros/eu`, { method: 'DELETE' }),

  removerMembro: (campanhaId: string, membroId: string) =>
    pedir<void>(`/api/campanhas/${campanhaId}/membros/${membroId}`, { method: 'DELETE' }),
};

/** O login sai do SPA: o Discord responde ao servidor, não ao cliente. */
export const CAMINHO_LOGIN = '/api/auth/discord';
