import { useId, type InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
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
    <input {...props} id={inputId} aria-invalid={error ? true : invalid}
      aria-describedby={descriptions} />
    {hint && <p id={`${inputId}-hint`} className="qf-field__hint">{hint}</p>}
    {error && <p id={`${inputId}-error`} className="qf-field__error">{error}</p>}
  </div>;
}
