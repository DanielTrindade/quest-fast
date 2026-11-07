import { useContext, useState, type ReactElement, type ReactNode } from 'react';
import * as Primitive from '@radix-ui/react-tooltip';
import { PortalContext } from '../lib/portal-context';

export const TooltipProvider = Primitive.Provider;

/**
 * `disabled` keeps the trigger mounted under the same parent: toggling the
 * wrapper instead would remount the control and drop its focus.
 */
export function Tooltip({ label, side = 'right', disabled = false, children }: {
  label: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; disabled?: boolean; children: ReactElement;
}) {
  const container = useContext(PortalContext);
  const [open, setOpen] = useState(false);
  return <Primitive.Root open={open && !disabled} onOpenChange={setOpen}>
    <Primitive.Trigger asChild>{children}</Primitive.Trigger>
    <Primitive.Portal container={container}>
      <Primitive.Content side={side} sideOffset={8} className="qf-tooltip">{label}</Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
