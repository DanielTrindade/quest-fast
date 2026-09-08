import type { Papel } from './roles.ts';

/**
 * Contrato entre servidor e cliente. Datas trafegam como ISO 8601; a
 * formatação para a mesa é decisão do cliente.
 */

export type RespostaErro = { erro: string };

export type UsuarioPublico = {
  id: string;
  nome: string;
  avatarUrl: string | null;
};

export type CampanhaResumo = {
  id: string;
  nome: string;
  descricao: string;
  papel: Papel;
  entrouEm: string;
};

/** `codigoConvite` só existe quando quem lê é o mestre. */
export type CampanhaDetalhe = {
  id: string;
  nome: string;
  descricao: string;
  papel: Papel;
  codigoConvite?: string;
};

export type CampanhaCriada = CampanhaDetalhe & { codigoConvite: string };

export type EntradaNaCampanha = {
  id: string;
  nome: string;
  papel: Papel;
};

export type MembroDaCampanha = {
  id: string;
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  papel: Papel;
  entrouEm: string;
};

export type RespostaMe = { usuario: UsuarioPublico };
export type RespostaCampanhas = { campanhas: CampanhaResumo[] };
export type RespostaMembros = { membros: MembroDaCampanha[] };
