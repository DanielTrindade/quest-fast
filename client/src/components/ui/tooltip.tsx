import * as Primitive from '@radix-ui/react-tooltip';
import { useContext, type ComponentProps } from 'react';
import { PortalContext } from '../../lib/portal-context';
import { cn } from '../../lib/utils';

export function TooltipProvider({ delayDuration = 400, skipDelayDuration = 300, ...props }: ComponentProps<typeof Primitive.Provider>) {
  return <Primitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />;
}

export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;

// Only the delayed first tooltip animates: "instant-open" means the pointer
// came from another tooltip, and motion there would only slow the scan.
export function TooltipContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content>) {
  const container = useContext(PortalContext);
  return <Primitive.Portal container={container}>
    <Primitive.Content data-slot="tooltip-content" sideOffset={sideOffset} className={cn(
      'z-50 max-w-xs origin-(--radix-tooltip-content-transform-origin) [&_kbd]:font-mono [&_kbd]:text-micro rounded-control bg-foreground px-2 py-1 text-small text-background ease-settle data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-97 data-[state=delayed-open]:duration-(--duration-quick) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--duration-instant)',
      className)} {...props} />
  </Primitive.Portal>;
}
