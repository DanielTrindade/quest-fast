/**
 * O código é ditado em voz alta na mesa. O alfabeto exclui os caracteres que
 * se confundem ao falar ou ao ler: O e 0, I e 1, L.
 */
export const ALFABETO_CONVITE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const TAMANHO_CODIGO_CONVITE = 6;

/** Separadores que aparecem quando alguém copia o código à mão. */
const SEPARADORES = /[\s-]+/g;

/**
 * Maior múltiplo do alfabeto que cabe em um byte. Sortear acima disso e usar
 * o resto enviesaria as primeiras letras do alfabeto.
 */
const LIMITE_SEM_VIES = Math.floor(256 / ALFABETO_CONVITE.length) * ALFABETO_CONVITE.length;

/** Usa Web Crypto, presente no Node e no navegador: `shared/` roda nos dois. */
export function gerarCodigoConvite(): string {
  let codigo = '';
  const buffer = new Uint8Array(TAMANHO_CODIGO_CONVITE);
  while (codigo.length < TAMANHO_CODIGO_CONVITE) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= LIMITE_SEM_VIES) continue;
      codigo += ALFABETO_CONVITE[byte % ALFABETO_CONVITE.length];
      if (codigo.length === TAMANHO_CODIGO_CONVITE) break;
    }
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
