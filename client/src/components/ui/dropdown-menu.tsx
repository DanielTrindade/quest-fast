import * as Primitive from '@radix-ui/react-dropdown-menu';
import { useContext, type ComponentProps } from 'react';
import { Check } from '@phosphor-icons/react';
import { PortalContext } from '../../lib/portal-context';
import { cn } from '../../lib/utils';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof Primitive.Content>) {
  const container = useContext(PortalContext);
  return <Primitive.Portal container={container}>
    <Primitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn(
      'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-60 max-w-[min(320px,calc(100vw-16px))] origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto overscroll-contain rounded-panel border border-border-strong bg-popover p-1 text-popover-foreground elevation-popover ease-settle data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-96 data-[state=open]:duration-(--duration-quick) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-96 data-[state=closed]:duration-(--duration-instant)',
      className)} {...props} />
  </Primitive.Portal>;
}

const item = 'relative flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-control px-2 py-1 outline-none data-highlighted:bg-muted data-disabled:cursor-default data-disabled:text-text-muted [&_svg]:pointer-events-none [&_svg]:shrink-0';

export function DropdownMenuItem({ className, variant = 'default', ...props }:
  ComponentProps<typeof Primitive.Item> & { variant?: 'default' | 'destructive' }) {
  return <Primitive.Item data-slot="dropdown-menu-item" data-variant={variant}
    className={cn(item, 'data-[variant=destructive]:text-danger-text', className)} {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof Primitive.RadioItem>) {
  return <Primitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn(item, 'pr-9', className)} {...props}>
    {children}
    <span className="pointer-events-none absolute right-3 flex text-accent-text">
      <Primitive.ItemIndicator><Check size={16} weight="bold" aria-hidden="true" /></Primitive.ItemIndicator>
    </span>
  </Primitive.RadioItem>;
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label data-slot="dropdown-menu-label" className={cn('px-2 pt-2 pb-1 text-micro text-text-muted', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator data-slot="dropdown-menu-separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
