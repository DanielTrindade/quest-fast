import { useId, type ReactNode } from 'react';

/** A native select with the field styling, for short fixed lists. */
export function SelectField({ label, value, onChange, className = '', invalid = false, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`qf-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="qf-input" value={value} aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}
