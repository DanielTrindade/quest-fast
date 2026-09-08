import { useId, type InputHTMLAttributes } from 'react';
import { Input } from './Input';

// `children` is omitted on purpose: Field renders its own <input>, and a
// void element cannot take children. Without this the compiler accepts
// <Field><Input /></Field>, which only fails at runtime, taking the whole
// subtree down with React error #137.
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Field({ label, hint, error, id, className = '',
  'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptions = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`]
    .filter(Boolean).join(' ') || undefined;
  return <div className={`qf-field ${className}`}>
    <label htmlFor={inputId}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>
    <Input {...props} id={inputId} aria-invalid={error ? true : invalid}
      aria-describedby={descriptions} />
    {hint && <p id={`${inputId}-hint`} className="qf-field__hint">{hint}</p>}
    {error && <p id={`${inputId}-error`} className="qf-field__error">{error}</p>}
  </div>;
}
