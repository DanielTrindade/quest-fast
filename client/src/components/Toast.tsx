import * as Primitive from '@radix-ui/react-toast';
import { CheckCircle, WarningCircle, Info, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function ToastProvider({ children }: { children: ReactNode }) {
  return <Primitive.Provider duration={6000} swipeDirection="right">
    {children}<Primitive.Viewport className="qf-toast-viewport" label="Notificações ({hotkey})" />
  </Primitive.Provider>;
}

export function Toast({ title, description, variant = 'info', open, onOpenChange }: {
  title: string; description?: string; variant?: 'success' | 'error' | 'info';
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const Icon = { success: CheckCircle, error: WarningCircle, info: Info }[variant];
  return <Primitive.Root open={open} onOpenChange={onOpenChange}
    type={variant === 'error' ? 'foreground' : 'background'} className={`qf-toast qf-toast--${variant}`}>
    <Icon className="qf-toast__icon" size={22} weight="regular" aria-hidden="true" />
    <div><Primitive.Title className="qf-toast__title">{title}</Primitive.Title>
      {description && <Primitive.Description className="qf-toast__description">{description}</Primitive.Description>}
    </div>
    <Primitive.Close className="qf-icon-button" aria-label="Dispensar notificação">
      <X size={18} aria-hidden="true" />
    </Primitive.Close>
  </Primitive.Root>;
}
