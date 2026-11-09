import { useId } from 'react';
import type { ProficiencyLevel } from '@quest-fast/shared';
import { PROFICIENCY_LABELS } from '../lib/sheet-labels';
import { ProficiencyMarker } from './ProficiencyMarker';
import { cn } from '../lib/utils';
import { segmentedGroup, segmentedRadio } from './ui/segmented';

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
    <div className="flex min-w-0 items-center justify-between gap-2 py-0.5" role="radiogroup" aria-labelledby={`${id}-label`}>
      <span className="grid min-w-0 text-small [overflow-wrap:anywhere]" id={`${id}-label`}>
        {label}
        {detail && <span className="font-mono text-micro text-text-secondary tabular-nums">{detail}</span>}
      </span>
      <span className={cn(segmentedGroup, 'shrink-0 flex-nowrap gap-0.5 p-0.5')}>
        {LEVELS.map((level) => (
          <label key={level} className={cn(segmentedRadio, 'size-9 min-h-9 px-0')} title={PROFICIENCY_LABELS[level]}>
            <input type="radio" name={id} value={level} checked={value === level} disabled={disabled}
              aria-label={PROFICIENCY_LABELS[level]} onChange={() => onChange(level)} />
            <ProficiencyMarker level={level} withText={false} />
          </label>
        ))}
      </span>
    </div>
  );
}
