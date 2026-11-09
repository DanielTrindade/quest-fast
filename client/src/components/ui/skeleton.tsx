import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('h-4 rounded-control bg-border-strong motion-safe:animate-pulse', className)} {...props} />;
}
