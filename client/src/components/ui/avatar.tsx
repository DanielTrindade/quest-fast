import * as Primitive from '@radix-ui/react-avatar';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Avatar({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="avatar" className={cn(
    'relative flex size-10 shrink-0 overflow-hidden rounded-full border border-border-strong bg-muted', className)} {...props} />;
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof Primitive.Image>) {
  return <Primitive.Image data-slot="avatar-image" className={cn('aspect-square size-full object-cover', className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: ComponentProps<typeof Primitive.Fallback>) {
  return <Primitive.Fallback data-slot="avatar-fallback" className={cn(
    'flex size-full items-center justify-center font-semibold text-text-secondary', className)} {...props} />;
}
