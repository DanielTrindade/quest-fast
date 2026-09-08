import { randomInt } from 'node:crypto';

/**
 * O código é ditado em voz alta na mesa. O alfabeto exclui os caracteres que
 * se confundem ao falar ou ao ler: O e 0, I e 1, L.
 */
export const ALFABETO_CONVITE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const TAMANHO_CODIGO_CONVITE = 6;

/** Separadores que aparecem quando alguém copia o código à mão. */
const SEPARADORES = /[\s-]+/g;

export function gerarCodigoConvite(): string {
  let codigo = '';
  for (let i = 0; i < TAMANHO_CODIGO_CONVITE; i++) {
    codigo += ALFABETO_CONVITE[randomInt(ALFABETO_CONVITE.length)];
  }
  return codigo;
}

/**
 * Devolve o código em forma canônica, ou `undefined` quando a entrada não
 * pode ser um código. Quem chama decide o erro a exibir.
 */
export function normalizarCodigoConvite(entrada: string): string | undefined {
  const candidato = entrada.replace(SEPARADORES, '').toUpperCase();
  if (candidato.length !== TAMANHO_CODIGO_CONVITE) return undefined;
  for (const char of candidato) {
    if (!ALFABETO_CONVITE.includes(char)) return undefined;
  }
  return candidato;
}
