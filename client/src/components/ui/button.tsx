import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-control border border-transparent text-body font-medium transition-[transform,background-color,border-color,color] duration-(--duration-quick) ease-settle motion-safe:active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-text-muted disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground edge-action hover:bg-primary-hover',
        destructive: 'bg-destructive text-destructive-foreground edge-action hover:bg-destructive-hover',
        secondary: 'border-input bg-card text-foreground edge-raised hover:bg-muted',
        outline: 'border-border-strong bg-transparent text-foreground hover:bg-muted',
        ghost: 'bg-transparent text-accent-text hover:bg-muted',
        link: 'bg-transparent text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-9 px-3 text-small',
        lg: 'min-h-12 px-6',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, asChild = false, type = 'button', ...props }:
  ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component data-slot="button" type={asChild ? undefined : type}
    className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
