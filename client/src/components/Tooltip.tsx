import { useState, type ReactElement, type ReactNode } from 'react';
import { Tooltip as Root, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export { TooltipProvider };

/**
 * `disabled` keeps the trigger mounted under the same parent: toggling the
 * wrapper instead would remount the control and drop its focus.
 */
export function Tooltip({ label, side = 'right', disabled = false, children }: {
  label: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; disabled?: boolean; children: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return <Root open={open && !disabled} onOpenChange={setOpen}>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side}>{label}</TooltipContent>
  </Root>;
}
