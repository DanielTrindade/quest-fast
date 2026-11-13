import { initials } from '../lib/initials';
import { cn } from '../lib/utils';

/**
 * The portrait that fills a card or a showcase. Without an uploaded image the
 * initials stand in, large and quiet, never a stock illustration.
 */
export function CharacterPortrait({ name, src, className, initialsClassName }: {
  name: string; src: string | null; className?: string; initialsClassName?: string;
}) {
  return (
    <span data-slot="character-portrait"
      className={cn('relative grid place-items-center overflow-hidden bg-surface-secret', className)}>
      {src
        ? <img src={src} alt={`Retrato de ${name}`} className="absolute inset-0 size-full object-cover object-top" />
        : <span role="img" aria-label={`Sem retrato: ${name}`}
          className={cn('font-display font-bold tracking-[-0.03em] text-text-secondary', initialsClassName)}>
          {initials(name)}
        </span>}
    </span>
  );
}
