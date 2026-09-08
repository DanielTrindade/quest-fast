import type { CSSProperties } from 'react';

export function Skeleton({ shape = 'line', width, label = 'Carregando…' }: {
  shape?: 'line' | 'avatar' | 'panel'; width?: CSSProperties['width']; label?: string;
}) {
  return <span className={`qf-skeleton qf-skeleton--${shape}`} style={{ width }}
    role="status" aria-label={label} />;
}
