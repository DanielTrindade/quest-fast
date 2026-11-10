import { DiceFive } from '@phosphor-icons/react';
import type { ProficiencyLevel, Skill } from '@quest-fast/shared';
import { PROFICIENCY_LABELS, signedBonus } from '../lib/sheet-labels';
import { ProficiencyMarker } from './ProficiencyMarker';
import { cn } from '../lib/utils';

const row = 'flex min-h-9 w-full items-center gap-2 rounded-control border border-transparent bg-transparent px-2 py-1 text-start text-small text-foreground';
const modifierClass = 'm-0 inline-flex min-h-11 items-center gap-2 rounded-control border border-transparent px-2 font-mono text-h1 font-semibold text-foreground tabular-nums';

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
      <span className="min-w-[2.5ch] text-end font-mono text-text-secondary tabular-nums">{signedBonus(bonus)}</span>
      <span className="min-w-0 flex-1 [overflow-wrap:break-word] hyphens-auto group-data-strong/row:font-semibold">{label}</span>
    </>
  );
  return (
    <li data-strong={strong || undefined} className="group/row data-strong:mb-1 data-strong:border-b data-strong:border-border data-strong:pb-1">
      {onRoll ? (
        <button type="button" className={cn(row, 'cursor-pointer transition-[background-color,border-color] duration-(--duration-quick) ease-settle hover:not-disabled:border-border hover:not-disabled:bg-card disabled:cursor-not-allowed disabled:text-text-muted')} disabled={disabled} onClick={onRoll}
          aria-label={`${rollLabel} (${signedBonus(bonus)}, ${PROFICIENCY_LABELS[marker].toLowerCase()})`}>
          {content}
          <DiceFive size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        </button>
      ) : (
        <span className={row}>{content}</span>
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
    <section aria-label={label} className="grid min-w-0 content-start gap-2 rounded-panel border border-border-strong bg-background p-3 edge-raised">
      <header className="flex items-baseline justify-between gap-2">
        <span className="font-display font-semibold tracking-[0.04em]">{abbreviation}</span>
        <span className="text-small text-text-secondary">{label}</span>
      </header>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        {onCheck ? (
          <button type="button" className={cn(modifierClass, 'cursor-pointer border-input bg-card edge-raised transition-[background-color,transform] duration-(--duration-quick) ease-settle hover:not-disabled:bg-muted motion-safe:active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:text-text-muted [&>svg]:text-text-muted')} disabled={disabled} onClick={onCheck}
            aria-label={`Teste de ${label} (${signedBonus(modifier)})`}>
            {signedBonus(modifier)}
            <DiceFive size={16} aria-hidden="true" />
          </button>
        ) : (
          <strong className={modifierClass}>
            <span className="sr-only">Modificador </span>
            {signedBonus(modifier)}
          </strong>
        )}
        <span className="grid min-w-11 justify-items-center rounded-control border border-border bg-card px-2 py-1">
          <span className="text-micro text-text-muted">Valor</span>
          <b className="font-mono font-medium tabular-nums">{score}</b>
        </span>
      </div>
      <ul className="m-0 grid list-none gap-0.5 p-0">
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
