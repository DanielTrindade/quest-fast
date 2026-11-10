import type { HTMLAttributes } from 'react';
import { EyeSlash } from '@phosphor-icons/react';
import { cn } from '../lib/utils';

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'base' | 'raised' | 'overlay' | 'secret' | 'sheet';
};

const VARIANT = {
  base: 'bg-background',
  raised: 'bg-card edge-raised',
  overlay: 'bg-popover edge-raised',
  secret: 'border-dashed border-input bg-surface-secret',
  sheet: 'border-border-strong bg-card p-6 edge-raised',
};

export function Surface({ variant = 'raised', className, children, ...props }: SurfaceProps) {
  return <div {...props} data-slot="surface" data-variant={variant}
    className={cn('min-w-0 rounded-panel border border-border p-4 text-foreground', VARIANT[variant], className)}>
    {variant === 'secret' && <p className="mb-3 flex items-center gap-2 text-small text-text-secondary">
      <EyeSlash size={16} weight="regular" aria-hidden="true" /> Só você vê isto
    </p>}
    {children}
  </div>;
}
