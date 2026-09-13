import { DiceFive } from '@phosphor-icons/react';
import type { ProficiencyLevel, Skill } from '@quest-fast/shared';
import { PROFICIENCY_LABELS, signedBonus } from '../lib/sheet-labels';
import { ProficiencyMarker } from './ProficiencyMarker';

export type AbilitySkillRow = { skill: Skill; label: string; bonus: number; proficiency: ProficiencyLevel };

function Row({ marker, bonus, label, strong = false, rollLabel, onRoll, disabled }: {
  marker: ProficiencyLevel;
  bonus: number;
  label: string;
  strong?: boolean;
  rollLabel: string;
  onRoll?: () => void;
  disabled: boolean;
}) {
  const content = (
    <>
      <ProficiencyMarker level={marker} withText={!onRoll} />
      <span className="qf-ability-block__bonus">{signedBonus(bonus)}</span>
      <span className="qf-ability-block__label">{label}</span>
    </>
  );
  return (
    <li data-strong={strong || undefined}>
      {onRoll ? (
        <button type="button" className="qf-ability-block__row" disabled={disabled} onClick={onRoll}
          aria-label={`${rollLabel} (${signedBonus(bonus)}, ${PROFICIENCY_LABELS[marker].toLowerCase()})`}>
          {content}
          <DiceFive size={14} className="qf-ability-block__dice" aria-hidden="true" />
        </button>
      ) : (
        <span className="qf-ability-block__row">{content}</span>
      )}
    </li>
  );
}

/**
 * One ability as the official sheet draws it: modifier, score, saving throw
 * and the skills that depend on it. Presents only; bonuses arrive computed.
 */
export function AbilityBlock({ label, abbreviation, score, modifier, saveBonus, saveProficient, skills, onCheck, onSave, onSkill, disabled = false }: {
  label: string;
  abbreviation: string;
  score: number;
  modifier: number;
  saveBonus: number;
  saveProficient: boolean;
  skills: AbilitySkillRow[];
  onCheck?: () => void;
  onSave?: () => void;
  onSkill?: (skill: Skill) => void;
  disabled?: boolean;
}) {
  return (
    <section className="qf-ability-block" aria-label={label}>
      <header className="qf-ability-block__head">
        <span className="qf-ability-block__abbr">{abbreviation}</span>
        <span className="qf-ability-block__name">{label}</span>
      </header>
      <div className="qf-ability-block__values">
        {onCheck ? (
          <button type="button" className="qf-ability-block__modifier" disabled={disabled} onClick={onCheck}
            aria-label={`Teste de ${label} (${signedBonus(modifier)})`}>
            {signedBonus(modifier)}
            <DiceFive size={16} aria-hidden="true" />
          </button>
        ) : (
          <strong className="qf-ability-block__modifier">
            <span className="sr-only">Modificador </span>
            {signedBonus(modifier)}
          </strong>
        )}
        <span className="qf-ability-block__score">
          <span>Valor</span>
          <b>{score}</b>
        </span>
      </div>
      <ul className="qf-ability-block__rows">
        <Row marker={saveProficient ? 'proficient' : 'none'} bonus={saveBonus} label="Salvaguarda" strong
          rollLabel={`Salvaguarda de ${label}`} onRoll={onSave} disabled={disabled} />
        {skills.map((row) => (
          <Row key={row.skill} marker={row.proficiency} bonus={row.bonus} label={row.label}
            rollLabel={`Teste de ${row.label}`} onRoll={onSkill ? () => onSkill(row.skill) : undefined} disabled={disabled} />
        ))}
      </ul>
    </section>
  );
}
