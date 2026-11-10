import { Toaster as Sonner } from 'sonner';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

export type ToastVariant = 'success' | 'error' | 'info';

const VARIANT = {
  success: { icon: CheckCircle, root: 'border-s-4 border-success bg-(--color-success-surface)', tone: 'text-success-text' },
  error: { icon: WarningCircle, root: 'border-s-4 border-danger bg-(--color-danger-surface)', tone: 'text-danger-text' },
  info: { icon: Info, root: 'border-border-strong bg-popover', tone: 'text-accent-text' },
};

/** Sonner keeps position, stacking, timers and swipe; the look is ours. */
export function Toaster({ id }: { id?: string }) {
  return <Sonner id={id} position="bottom-right" duration={6000} gap={8} visibleToasts={4}
    containerAriaLabel="Notificações" toastOptions={{ unstyled: true }}
    style={{ '--width': '400px' } as CSSProperties} />;
}

export function ToastCard({ title, description, variant = 'info', onDismiss }: {
  title: string; description?: string; variant?: ToastVariant; onDismiss: () => void;
}) {
  const { icon: Icon, root, tone } = VARIANT[variant];
  return <div data-slot="toast" data-variant={variant}
    className={cn('flex w-full items-start gap-3 rounded-panel border p-3 font-sans text-body text-popover-foreground elevation-popover [overflow-wrap:anywhere]', root)}>
    <span className={cn('mt-2 flex shrink-0 rounded-control border border-border bg-background p-1', tone)}>
      <Icon size={22} aria-hidden="true" />
    </span>
    <div className="min-w-0 flex-1 py-2">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 text-small text-text-secondary">{description}</p>}
    </div>
    <button type="button" aria-label="Dispensar notificação" onClick={onDismiss}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-text-secondary transition-[background-color,color] duration-(--duration-quick) hover:bg-muted hover:text-foreground">
      <X size={18} aria-hidden="true" />
    </button>
  </div>;
}
