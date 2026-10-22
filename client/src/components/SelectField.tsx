import { useId, type ReactNode } from 'react';

/** A native select with the field styling, for short fixed lists. */
export function SelectField({ label, value, onChange, className = '', children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`qf-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="qf-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}
