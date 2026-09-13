import { Circle, Diamond } from '@phosphor-icons/react';
import type { ProficiencyLevel } from '@quest-fast/shared';
import { PROFICIENCY_LABELS } from '../lib/sheet-labels';

/** Empty circle, filled circle or filled diamond, spelled out for screen readers. */
export function ProficiencyMarker({ level, withText = true }: { level: ProficiencyLevel; withText?: boolean }) {
  return (
    <span className="qf-marker" data-level={level}>
      {level === 'expert'
        ? <Diamond size={14} weight="fill" aria-hidden="true" />
        : <Circle size={14} weight={level === 'proficient' ? 'fill' : 'regular'} aria-hidden="true" />}
      {withText && <span className="sr-only">{PROFICIENCY_LABELS[level]}</span>}
    </span>
  );
}
