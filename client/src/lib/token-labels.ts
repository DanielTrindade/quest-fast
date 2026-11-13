import type { TokenKind, TokenView } from '@quest-fast/shared';

export const TOKEN_KIND_LABELS: Record<TokenKind, string> = {
  character: 'Personagem',
  combatant: 'Combatente',
  free: 'Token livre',
};

/** The master moves any token; a player only their own character's. The server checks the same. */
export function canMoveToken(token: TokenView, viewerId: string | null, master: boolean): boolean {
  return master || (token.kind === 'character' && viewerId !== null && token.ownerId === viewerId);
}
