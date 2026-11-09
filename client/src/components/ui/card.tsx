import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn(
    'flex min-w-0 flex-col gap-6 rounded-panel border border-border bg-card py-6 text-card-foreground edge-raised',
    className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn(
    'grid auto-rows-min items-start gap-1 px-6 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]',
    className)} {...props} />;
}

export function CardTitle({ className, asChild = false, ...props }: ComponentProps<'div'> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'div';
  return <Component data-slot="card-title" className={cn('font-display text-h2 font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-muted-foreground', className)} {...props} />;
}

export function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-action" className={cn(
    'col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center gap-2 px-6', className)} {...props} />;
}
