import * as Primitive from '@radix-ui/react-dialog';
import { useContext, type ComponentProps } from 'react';
import { X } from '@phosphor-icons/react';
import { PortalContext } from '../../lib/portal-context';
import { cn } from '../../lib/utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  const container = useContext(PortalContext);
  return <Primitive.Portal container={container}>
    <Primitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-40 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--duration-settle) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--duration-quick)" />
    <Primitive.Content data-slot="dialog-content" className={cn(
      'fixed top-1/2 left-1/2 z-41 grid max-h-[calc(100dvh-32px)] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-panel border border-border-strong bg-popover p-(--qf-dialog-pad) text-popover-foreground [--qf-dialog-pad:var(--spacing-6)] elevation-dialog ease-settle data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-96 data-[state=open]:duration-(--duration-settle) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-96 data-[state=closed]:duration-(--duration-quick)',
      className)} {...props}>
      {children}
      <Primitive.Close className="absolute top-2 right-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-control text-text-secondary transition-[background-color,color] duration-(--duration-quick) hover:bg-muted hover:text-foreground" aria-label="Fechar diálogo">
        <X size={20} aria-hidden="true" />
      </Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>;
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('grid gap-2 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex flex-wrap justify-end gap-2', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title data-slot="dialog-title" className={cn('font-display text-h1 font-semibold tracking-tight', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description data-slot="dialog-description" className={cn('text-muted-foreground', className)} {...props} />;
}
