import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({ variant = 'primary', loading = false, disabled,
  type = 'button', className = '', children, ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading}
    aria-busy={loading || undefined} className={`qf-button qf-button--${variant} ${className}`}>
    {loading && <span className="qf-button__loading" aria-hidden="true" />}
    {children}
  </button>;
}
