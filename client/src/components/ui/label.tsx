import * as Primitive from '@radix-ui/react-label';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Label({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="label" className={cn(
    'flex select-none items-center gap-2 font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:text-text-muted',
    className)} {...props} />;
}
