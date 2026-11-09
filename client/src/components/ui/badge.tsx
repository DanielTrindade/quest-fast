import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-control border px-2 py-0.5 text-small font-medium [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border-strong bg-card text-text-secondary edge-raised',
        outline: 'border-border-strong text-foreground',
        accent: 'border-input bg-card text-accent-text edge-raised',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({ className, variant, asChild = false, ...props }:
  ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'span';
  return <Component data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
