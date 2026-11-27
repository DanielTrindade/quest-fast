import { useId, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';

/** A native select with the field styling, for short fixed lists. */
export function SelectField({ label, value, onChange, className, invalid = false, disabled = false, hint, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** A line under the field, read with it. */
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div data-slot="field" className={cn('grid min-w-0 content-start gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} aria-invalid={invalid || undefined} disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}>
        {children}
      </NativeSelect>
      {hint && <p id={`${id}-hint`} className="m-0 text-small text-text-muted">{hint}</p>}
    </div>
  );
}
