import type { TokenKind, TokenView } from '@quest-fast/shared';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

/** The ring of each origin, the same tones the map draws. */
const RING: Record<TokenKind, string> = {
  character: 'border-accent',
  combatant: 'border-danger',
  free: 'border-border-strong',
};

/**
 * A token as the DOM shows it: the avatar, or the initials while it loads or
 * when it fails, in its origin's ring. Decorative: the name is beside it.
 */
export function TokenDisc({ token, className }: { token: Pick<TokenView, 'kind' | 'avatarUrl' | 'initials' | 'hidden'>; className?: string }) {
  return (
    <Avatar aria-hidden="true" className={cn(
      'size-10 flex-none border-[3px] bg-card font-display text-small',
      RING[token.kind], token.hidden && 'border-dashed opacity-70', className,
    )}>
      {token.avatarUrl && <AvatarImage src={token.avatarUrl} alt="" className="object-[50%_20%]" />}
      <AvatarFallback className="bg-card text-foreground">{token.initials}</AvatarFallback>
    </Avatar>
  );
}
