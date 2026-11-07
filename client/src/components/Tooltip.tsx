import { useContext, type ReactElement, type ReactNode } from 'react';
import * as Primitive from '@radix-ui/react-tooltip';
import { PortalContext } from '../lib/portal-context';

export const TooltipProvider = Primitive.Provider;

export function Tooltip({ label, side = 'right', children }: {
  label: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactElement;
}) {
  const container = useContext(PortalContext);
  return <Primitive.Root>
    <Primitive.Trigger asChild>{children}</Primitive.Trigger>
    <Primitive.Portal container={container}>
      <Primitive.Content side={side} sideOffset={8} className="qf-tooltip">{label}</Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
