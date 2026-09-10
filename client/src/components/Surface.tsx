import type { HTMLAttributes } from 'react';
import { EyeSlash } from '@phosphor-icons/react';

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'base' | 'raised' | 'overlay' | 'secret' | 'sheet';
};

export function Surface({ variant = 'raised', className = '', children, ...props }: SurfaceProps) {
  return <div {...props} className={`qf-surface qf-surface--${variant} ${className}`}>
    {variant === 'secret' && <p className="qf-surface__restriction">
      <EyeSlash size={16} weight="regular" aria-hidden="true" /> Só você vê isto
    </p>}
    {children}
  </div>;
}
