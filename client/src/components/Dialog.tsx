import type { ReactElement, ReactNode } from 'react';
import * as UI from './ui/dialog';

export function Dialog({ trigger, title, description, children, open, onOpenChange }: {
  trigger: ReactElement; title: string; description: string; children: ReactNode;
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  return <UI.Dialog open={open} onOpenChange={onOpenChange}>
    <UI.DialogTrigger asChild>{trigger}</UI.DialogTrigger>
    <UI.DialogContent>
      <header className="qf-dialog__header">
        <UI.DialogTitle>{title}</UI.DialogTitle>
        <UI.DialogDescription>{description}</UI.DialogDescription>
      </header>
      {children}
    </UI.DialogContent>
  </UI.Dialog>;
}
