import type { ButtonHTMLAttributes } from 'react';
import { Button as UIButton } from './ui/button';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

const VARIANT = { primary: 'default', secondary: 'secondary', ghost: 'ghost', danger: 'destructive' } as const;

export function Button({ variant = 'primary', loading = false, disabled, children, ...props }: ButtonProps) {
  return <UIButton {...props} variant={VARIANT[variant]} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className="size-2.5 shrink-0 rotate-45 rounded-[2px] bg-current opacity-60 motion-safe:animate-pulse" aria-hidden="true" />}
    {children}
  </UIButton>;
}
