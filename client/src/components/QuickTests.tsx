import { useId, useState } from 'react';
import {
  ABILITIES,
  SKILLS,
  abilityModifier,
  saveBonus,
  skillBonus,
  skillProficiency,
  type CharacterSheet,
  type LinkedRollRequest,
  type RollMode,
  type Skill,
} from '@quest-fast/shared';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, SKILL_LABELS } from '../lib/5e';
import { signedBonus } from '../lib/sheet-labels';
import { ProficiencyMarker } from './ProficiencyMarker';
import { RollModeControl } from './RollModeControl';
import { segmentedGroup, segmentedRadio } from './ui/segmented';

type TestKind = 'check' | 'save';

const KIND_LABELS: Record<TestKind, string> = { check: 'Teste', save: 'Salvaguarda' };

const cell = 'grid min-h-16 min-w-0 cursor-pointer content-center justify-items-center gap-0.5 rounded-control border border-input bg-background px-1 py-2 text-foreground edge-raised transition-[background-color,border-color,transform] duration-(--duration-quick) ease-settle hover:not-disabled:border-border-strong hover:not-disabled:bg-muted motion-safe:active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:text-text-muted';
const chip = 'inline-flex min-h-10 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border border-border bg-background px-3 text-start text-small text-foreground transition-[background-color,border-color,transform] duration-(--duration-quick) ease-settle hover:not-disabled:border-border-strong hover:not-disabled:bg-muted motion-safe:active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:text-text-muted';

type TestSheet = Pick<CharacterSheet, 'name' | 'abilityScores' | 'level' | 'saves' | 'skills' | 'expertise'>;

function SkillChip({ sheet, skill, disabled, onRoll }: { sheet: TestSheet; skill: Skill; disabled: boolean; onRoll: () => void }) {
  const bonus = skillBonus(sheet, skill);
  return (
    <li className="min-w-0">
      <button type="button" className={chip} disabled={disabled} onClick={onRoll} aria-label={`Teste de ${SKILL_LABELS[skill]} (${signedBonus(bonus)})`}>
        <ProficiencyMarker level={skillProficiency(sheet, skill)} withText={false} />
        <span className="min-w-0 [overflow-wrap:anywhere]">{SKILL_LABELS[skill]}</span>
        <span className="font-mono text-text-secondary tabular-nums">{signedBonus(bonus)}</span>
      </button>
    </li>
  );
}

/**
 * The quick rolls of a sheet, for the table's side panel: the six abilities
 * as the sheet draws them (modifier big, abbreviation small), rolling a test
 * or a saving throw, then the trained skills and, folded, the others. One
 * mode for all of them. Only asks: the server rolls with the sheet's bonuses.
 */
export function QuickTests({ sheet, pending = false, onRoll }: {
  sheet: TestSheet;
  pending?: boolean;
  onRoll: (request: LinkedRollRequest) => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<TestKind>('check');
  const [mode, setMode] = useState<RollMode>('normal');
  const trained = SKILLS.filter((skill) => sheet.skills.includes(skill));
  const untrained = SKILLS.filter((skill) => !sheet.skills.includes(skill));
  const rollSkill = (skill: Skill) => onRoll({ kind: 'skill', skill, mode });

  return (
    <section aria-labelledby={`${id}-title`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="m-0 font-display text-h2 font-semibold">Testes</h3>
        <fieldset className={segmentedGroup} aria-label="O que os atributos rolam" disabled={pending}>
          {(['check', 'save'] as const).map((option) => (
            <label key={option} className={segmentedRadio}>
              <input type="radio" name={`${id}-kind`} value={option} checked={kind === option} onChange={() => setKind(option)} />
              <span>{KIND_LABELS[option]}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label={kind === 'check' ? 'Testes de atributo' : 'Salvaguardas'}>
        {ABILITIES.map((ability) => {
          const bonus = kind === 'check' ? (abilityModifier(sheet.abilityScores[ability]) ?? 0) : saveBonus(sheet, ability);
          const proficient = kind === 'save' && sheet.saves.includes(ability);
          return (
            <li key={ability} className="min-w-0">
              <button type="button" className={`${cell} w-full`} disabled={pending}
                onClick={() => onRoll({ kind, ability, mode })}
                aria-label={`${KIND_LABELS[kind]} de ${ABILITY_LABELS[ability]} (${signedBonus(bonus)}${proficient ? ', proficiente' : ''})`}>
                <span className="flex items-center gap-1 font-display text-small font-semibold tracking-[0.04em] text-text-secondary">
                  {proficient && <ProficiencyMarker level="proficient" withText={false} />}
                  {ABILITY_ABBREVIATIONS[ability]}
                </span>
                <span className="font-mono text-h1 leading-none font-semibold tabular-nums">{signedBonus(bonus)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {trained.length > 0 && (
        <ul className="m-0 flex min-w-0 list-none flex-wrap gap-2 p-0" aria-label="Perícias treinadas">
          {trained.map((skill) => <SkillChip key={skill} sheet={sheet} skill={skill} disabled={pending} onRoll={() => rollSkill(skill)} />)}
        </ul>
      )}

      <details className="group/skills min-w-0">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-control px-3 font-semibold text-accent-text transition-[background-color] duration-(--duration-quick) hover:bg-muted [&::-webkit-details-marker]:hidden">
          {trained.length > 0 ? 'Outras perícias' : 'Perícias'}
        </summary>
        <ul className="m-0 flex min-w-0 list-none flex-wrap gap-2 p-0 pt-2" aria-label={trained.length > 0 ? 'Outras perícias' : 'Perícias'}>
          {untrained.map((skill) => <SkillChip key={skill} sheet={sheet} skill={skill} disabled={pending} onRoll={() => rollSkill(skill)} />)}
        </ul>
      </details>

      <RollModeControl value={mode} onChange={setMode} disabled={pending} name={`${id}-mode`} label={`Tipo de rolagem dos testes de ${sheet.name}`} />
    </section>
  );
}
