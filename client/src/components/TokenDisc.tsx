import type { TokenKind, TokenView } from '@quest-fast/shared';
import { cn } from '../lib/utils';

/** The ring of each origin, the same tones the map draws. */
const RING: Record<TokenKind, string> = {
  character: 'border-accent',
  combatant: 'border-danger',
  free: 'border-border-strong',
};

/** A token as the DOM shows it: the avatar or the initials, in its origin's ring. Decorative: the name is beside it. */
export function TokenDisc({ token, className }: { token: Pick<TokenView, 'kind' | 'avatarUrl' | 'initials' | 'hidden'>; className?: string }) {
  return (
    <span aria-hidden="true" className={cn(
      'inline-grid size-10 flex-none place-items-center overflow-hidden rounded-full border-[3px] bg-card font-display text-small font-semibold text-foreground',
      RING[token.kind], token.hidden && 'border-dashed opacity-70', className,
    )}>
      {token.avatarUrl ? <img src={token.avatarUrl} alt="" className="size-full object-cover object-[50%_20%]" /> : token.initials}
    </span>
  );
}
