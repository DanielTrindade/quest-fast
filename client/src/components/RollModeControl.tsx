import type { RollMode } from '@quest-fast/shared';
import { ROLL_MODE_LABELS } from '../lib/5e';

const MODES: RollMode[] = ['normal', 'advantage', 'disadvantage'];

/** Segmented Normal/Vantagem/Desvantagem, shared by the free roller and the sheet. */
export function RollModeControl({ value, onChange, disabled = false, name = 'mode', label = 'Tipo de rolagem' }: {
  value: RollMode;
  onChange: (mode: RollMode) => void;
  disabled?: boolean;
  name?: string;
  label?: string;
}) {
  return (
    <fieldset className="qf-segmented" aria-label={label} disabled={disabled}>
      {MODES.map((mode) => (
        <label key={mode} className={value === mode ? 'is-active' : ''}>
          <input
            type="radio"
            name={name}
            value={mode}
            checked={value === mode}
            disabled={disabled}
            onChange={() => onChange(mode)}
          />
          <span>{ROLL_MODE_LABELS[mode]}</span>
        </label>
      ))}
    </fieldset>
  );
}