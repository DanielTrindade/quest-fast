import type { ComponentProps } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';
import { controlClass } from './control';

// Native on purpose: short fixed lists get the platform picker on mobile.
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <div data-slot="native-select-wrapper" className="relative min-w-0">
    <select data-slot="native-select" className={cn(controlClass, 'cursor-pointer appearance-none pr-9', className)} {...props} />
    <CaretDown size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted" />
  </div>;
}
