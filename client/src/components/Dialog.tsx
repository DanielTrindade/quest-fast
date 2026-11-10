import type { ReactElement, ReactNode } from 'react';
import { Dialog as Root, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

export function Dialog({ trigger, title, description, children, open, onOpenChange, className }: {
  trigger?: ReactElement; title: string; description: string; children: ReactNode;
  open?: boolean; onOpenChange?: (open: boolean) => void; className?: string;
}) {
  return <Root open={open} onOpenChange={onOpenChange}>
    {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
    <DialogContent className={className}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="min-w-0">{children}</div>
    </DialogContent>
  </Root>;
}
