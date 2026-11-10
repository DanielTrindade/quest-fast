import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/utils';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

// `children` is omitted on purpose: Field renders its own control, and a
// void element cannot take children. Without this the compiler accepts
// <Field><Input /></Field>, which only fails at runtime, taking the whole
// subtree down with React error #137.
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label: string;
  hint?: string;
  error?: string;
  /** Renders a <textarea> with the same token styling instead of an input. */
  asTextarea?: boolean;
};

export function Field({ label, hint, error, id, className, asTextarea = false,
  'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptions = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`]
    .filter(Boolean).join(' ') || undefined;
  return <div data-slot="field" className={cn('grid min-w-0 content-start gap-2', className)}>
    <Label htmlFor={inputId}>{label}{props.required && <span aria-hidden="true" className="text-text-muted">*</span>}</Label>
    {asTextarea
      ? <Textarea {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} id={inputId}
          rows={3} aria-invalid={error ? true : invalid} aria-describedby={descriptions} />
      : <Input {...props} id={inputId} aria-invalid={error ? true : invalid}
          aria-describedby={descriptions} />}
    {hint && <p id={`${inputId}-hint`} className="text-small text-text-muted">{hint}</p>}
    {error && <p id={`${inputId}-error`} className="text-small text-danger-text">{error}</p>}
  </div>;
}
