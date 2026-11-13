import { cn } from '../lib/utils';

const SIZE = {
  sm: 'w-9 text-body',
  md: 'w-12 text-h2',
  lg: 'w-16 text-h1',
};

// A heater shield. Solid fills clipped to the shape, not an SVG behind the
// number, so the contrast audit can read the background it sits on.
const SHIELD = 'polygon(50% 0, 100% 12%, 100% 50%, 93% 70%, 78% 87%, 50% 100%, 22% 87%, 7% 70%, 0 50%, 0 12%)';

/**
 * Armour class inside a shield, the way the printed sheet draws it. The one
 * ornament of the character screens: everything around it stays plain.
 */
export function ArmorShield({ value, size = 'md', className }: {
  value: number; size?: keyof typeof SIZE; className?: string;
}) {
  return (
    <span data-slot="armor-shield" style={{ clipPath: SHIELD }}
      className={cn('relative grid aspect-[40/46] shrink-0 bg-border-strong p-[1.5px]', SIZE[size], className)}>
      <span style={{ clipPath: SHIELD }} className="grid place-items-center bg-surface-secret pb-[12%]">
        <b className="font-mono font-semibold tabular-nums text-foreground">
          <span className="sr-only">Classe de armadura </span>{value}
        </b>
      </span>
    </span>
  );
}
