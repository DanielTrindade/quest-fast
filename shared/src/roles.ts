/**
 * Papéis dentro de uma campanha. A autorização real acontece sempre no
 * servidor, a partir de `CampaignMember`; estes tipos apenas dão nome ao que
 * os dois lados trocam.
 */
export const PAPEIS = ['mestre', 'jogador'] as const;

export type Papel = (typeof PAPEIS)[number];

export function isPapel(value: unknown): value is Papel {
  return typeof value === 'string' && (PAPEIS as readonly string[]).includes(value);
}
