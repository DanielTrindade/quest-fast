// Composição shadcn/ui sobre Radix, adaptada aos tokens e ícones do quest-fast.
import * as Primitive from '@radix-ui/react-dialog';
import { useContext, type ComponentProps } from 'react';
import { X } from '@phosphor-icons/react';
import { PortalContext } from '../../lib/portal-context';
import { cn } from '../../lib/utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  const container = useContext(PortalContext);
  return <Primitive.Portal container={container}>
    <Primitive.Overlay className="qf-dialog-overlay" />
    <Primitive.Content {...props} className={cn('qf-dialog', className)}>
      {children}
      <Primitive.Close className="qf-icon-button qf-dialog__close" aria-label="Fechar diálogo">
        <X size={20} weight="regular" aria-hidden="true" />
      </Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>;
}
