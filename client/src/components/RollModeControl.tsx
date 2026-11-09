import type { RollMode } from '@quest-fast/shared';
import { ROLL_MODE_LABELS } from '../lib/5e';
import { segmentedGroup, segmentedRadio } from './ui/segmented';

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
    <fieldset className={segmentedGroup} aria-label={label} disabled={disabled}>
      {MODES.map((mode) => (
        <label key={mode} className={segmentedRadio}>
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