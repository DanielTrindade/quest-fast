import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';
import { Skeleton as UISkeleton } from './ui/skeleton';

const SHAPE = { line: 'w-full', avatar: 'size-full min-h-10 min-w-10 rounded-full', panel: 'h-32 w-full rounded-panel' };

export function Skeleton({ shape = 'line', width, label = 'Carregando…' }: {
  shape?: 'line' | 'avatar' | 'panel'; width?: CSSProperties['width']; label?: string;
}) {
  return <UISkeleton className={cn('block', SHAPE[shape])} style={{ width }} role="status" aria-label={label} />;
}
