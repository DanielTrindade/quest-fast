import { useId, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';

/** A native select with the field styling, for short fixed lists. */
export function SelectField({ label, value, onChange, className, invalid = false, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div data-slot="field" className={cn('grid min-w-0 content-start gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}>
        {children}
      </NativeSelect>
    </div>
  );
}
