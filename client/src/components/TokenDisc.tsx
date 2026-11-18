import type { TokenKind, TokenView } from '@quest-fast/shared';
import { SHAPE, shapeVertices } from '../lib/token-medallion';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

/** The band of each origin, the same tones the map draws. */
const BAND: Record<TokenKind, string> = {
  character: 'bg-accent',
  combatant: 'bg-danger',
  free: 'bg-border-strong',
};

/** The map's silhouettes as a clip path, in percent of the piece. */
function clipOf(kind: TokenKind): string | undefined {
  const vertices = shapeVertices(SHAPE[kind], 50);
  return vertices ? `polygon(${vertices.map(({ x, y }) => `${(50 + x).toFixed(2)}% ${(50 + y).toFixed(2)}%`).join(', ')})` : undefined;
}

const CLIP: Record<TokenKind, string | undefined> = { character: clipOf('character'), combatant: clipOf('combatant'), free: clipOf('free') };

/**
 * A token as the DOM shows it: the piece the map draws, with its origin's
 * silhouette and band around the avatar, or the initials while it loads or
 * when it fails. Decorative: the name is beside it.
 */
export function TokenDisc({ token, className }: {
  token: Pick<TokenView, 'kind' | 'avatarUrl' | 'initials' | 'hidden'> & Partial<Pick<TokenView, 'vitality'>>;
  className?: string;
}) {
  // The map's looks: a character down has the danger band, a defeated creature is grey and faded.
  return (
    <span aria-hidden="true" data-slot="token-disc" className={cn(
      'inline-flex size-10 flex-none drop-shadow-[0_1px_0_var(--color-edge-shadow)]',
      token.hidden && 'opacity-70',
      token.vitality === 'defeated' && 'opacity-60 grayscale',
      className,
    )}>
      <span className="flex size-full items-center justify-center rounded-full bg-border-control shadow-[inset_0_1px_0_var(--color-edge-light)]"
        style={{ clipPath: CLIP[token.kind] }}>
        <span className={cn(
          'flex size-[78%] items-center justify-center rounded-full p-0.5',
          token.vitality === 'down' ? 'bg-danger' : BAND[token.kind],
          token.hidden && 'outline-2 -outline-offset-2 outline-dashed outline-foreground',
        )}>
          <Avatar className={cn('size-full bg-card font-display text-small', token.vitality === 'down' && 'saturate-[.3]')}>
            {token.avatarUrl && <AvatarImage src={token.avatarUrl} alt="" className="object-[50%_20%]" />}
            <AvatarFallback className="bg-card text-foreground">{token.initials}</AvatarFallback>
          </Avatar>
        </span>
      </span>
    </span>
  );
}
