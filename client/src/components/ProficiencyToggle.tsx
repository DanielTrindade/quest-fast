import { useId } from 'react';
import type { ProficiencyLevel } from '@quest-fast/shared';
import { PROFICIENCY_LABELS } from '../lib/sheet-labels';
import { ProficiencyMarker } from './ProficiencyMarker';

const LEVELS: ProficiencyLevel[] = ['none', 'proficient', 'expert'];

/** A skill's proficiency in the editor: none, proficient or expert. */
export function ProficiencyToggle({ label, detail, value, onChange, disabled = false }: {
  label: string;
  /** e.g. the resulting bonus, read after the label. */
  detail?: string;
  value: ProficiencyLevel;
  onChange: (value: ProficiencyLevel) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="qf-prof-toggle" role="radiogroup" aria-labelledby={`${id}-label`}>
      <span className="qf-prof-toggle__label" id={`${id}-label`}>
        {label}
        {detail && <span className="qf-prof-toggle__detail">{detail}</span>}
      </span>
      <span className="qf-prof-toggle__options">
        {LEVELS.map((level) => (
          <label key={level} className={value === level ? 'is-active' : ''} title={PROFICIENCY_LABELS[level]}>
            <input type="radio" name={id} value={level} checked={value === level} disabled={disabled}
              aria-label={PROFICIENCY_LABELS[level]} onChange={() => onChange(level)} />
            <ProficiencyMarker level={level} withText={false} />
          </label>
        ))}
      </span>
    </div>
  );
}
