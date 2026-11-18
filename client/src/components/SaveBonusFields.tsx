import { ABILITIES, STATBLOCK_LIMITS as S, abilityModifier, type Ability } from '@quest-fast/shared';
import { Field } from './Field';
import { ABILITY_LABELS, signed } from '../lib/5e';
import { numberValue } from '../lib/form-attacks';
import { fieldset, grid3 } from './form-styles';

function inRange(text: string) {
  const bonus = numberValue(text);
  return Number.isInteger(bonus) && bonus >= S.saveBonus.min && bonus <= S.saveBonus.max;
}

/**
 * A statblock's proficient saves, as the book writes them. An empty field
 * rolls the ability modifier, which its hint shows. Values stay text while
 * they are typed.
 */
export function SaveBonusFields({ bonuses, scores, error, onChange }: {
  bonuses: Record<Ability, string>;
  /** The ability scores as typed: an empty save reads its modifier. */
  scores: Record<Ability, string>;
  error?: string;
  onChange: (bonuses: Record<Ability, string>) => void;
}) {
  return (
    <fieldset className={fieldset}>
      <legend>Salvaguardas</legend>
      <p className="m-0 text-small text-text-secondary">
        Só as salvaguardas em que a criatura é proficiente, com o bônus do livro. As vazias usam o modificador do atributo.
      </p>
      {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
      <div className={grid3}>
        {ABILITIES.map((ability) => {
          const text = bonuses[ability];
          const modifier = text === '' ? abilityModifier(Number(scores[ability])) : undefined;
          return (
            <Field key={ability} label={`Salvaguarda de ${ABILITY_LABELS[ability]}`} type="number" inputMode="numeric"
              min={S.saveBonus.min} max={S.saveBonus.max} value={text}
              hint={modifier === undefined ? 'Bônus do livro' : `Vazio: ${signed(modifier)}`}
              aria-invalid={Boolean(error) && text !== '' && !inRange(text)}
              onChange={(e) => onChange({ ...bonuses, [ability]: e.target.value })} />
          );
        })}
      </div>
    </fieldset>
  );
}
