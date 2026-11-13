import { initials } from '../lib/initials';
import { cn } from '../lib/utils';
import { Skeleton } from './Skeleton';
import { Avatar as Root, AvatarFallback, AvatarImage } from './ui/avatar';

const SIZE = { sm: 'size-10', md: 'size-14', lg: 'size-20 text-h2', xl: 'size-24 text-h1' };

// A character token gets a double ring, like a miniature's base.
const CHARACTER = 'border-input bg-background p-1 shadow-[inset_0_0_0_2px_var(--color-surface-raised),inset_0_0_0_3px_var(--color-border-strong),0_2px_0_var(--color-edge-shadow)]';

export function Avatar({ name, src, loading = false, variant = 'user', size = 'sm' }: {
  name: string; src?: string; loading?: boolean;
  variant?: 'user' | 'character'; size?: keyof typeof SIZE;
}) {
  const className = cn(SIZE[size], variant === 'character' && CHARACTER);
  if (loading) return <span className={cn('inline-flex shrink-0 overflow-hidden rounded-full', SIZE[size])}>
    <Skeleton shape="avatar" label={`Carregando avatar de ${name}`} />
  </span>;
  return <Root className={className}>
    <AvatarImage src={src} alt={name} className={variant === 'character' ? 'rounded-full object-[50%_20%]' : undefined} />
    <AvatarFallback role="img" aria-label={name}
      className={variant === 'character' ? 'rounded-full bg-muted font-display text-accent-text' : undefined}>
      {initials(name)}
    </AvatarFallback>
  </Root>;
}
