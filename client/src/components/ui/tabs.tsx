import * as Primitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Tabs({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return <Primitive.List data-slot="tabs-list" className={cn(
    'flex w-fit max-w-full items-center gap-1 rounded-panel border border-border bg-surface-secret p-1', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return <Primitive.Trigger data-slot="tabs-trigger" className={cn(
    'inline-flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control px-3 text-small font-medium text-text-secondary transition-[color,background-color] duration-(--duration-quick) ease-settle hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:edge-raised disabled:cursor-not-allowed disabled:text-text-muted [&_svg]:shrink-0',
    className)} {...props} />;
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content data-slot="tabs-content" className={cn('min-w-0 outline-none', className)} {...props} />;
}
