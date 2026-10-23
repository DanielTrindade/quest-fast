import { Plus, Trash } from '@phosphor-icons/react';
import { ABILITIES, CHARACTER_LIMITS, parseDiceExpression, type Ability } from '@quest-fast/shared';
import { Button } from './Button';
import { Field } from './Field';
import { SelectField } from './SelectField';
import { ABILITY_LABELS } from '../lib/5e';
import { emptyFormAttack, numberValue, type FormAttack } from '../lib/form-attacks';

const MAX_BONUS = CHARACTER_LIMITS.attackBonus;
const SAVE_DC = CHARACTER_LIMITS.saveDc;

/**
 * The editable attack list of the sheet and of the bestiary: each attack is a
 * small card with its own remove action. An attack is either an attack roll
 * (bonus against AC) or a save the target makes against a DC. `error` is the
 * list-level message from the validator; the fields it is about are marked
 * invalid.
 */
export function AttackListEditor({ attacks, onChange, error, notesHint = 'Ex.: Pesada, duas mãos' }: {
  attacks: FormAttack[];
  onChange: (attacks: FormAttack[]) => void;
  error?: string;
  notesHint?: string;
}) {
  const update = (index: number, patch: Partial<FormAttack>) =>
    onChange(attacks.map((attack, i) => (i === index ? { ...attack, ...patch } : attack)));
  return (
    <>
      {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
      <div className="qf-stack">
        {attacks.map((attack, index) => {
          const position = index + 1;
          const bonus = numberValue(attack.bonus);
          const dc = numberValue(attack.dc);
          return (
            <div key={attack.rowId} className="sheet-form__attack" role="group" aria-label={`Ataque ${position}`}>
              <div className="sheet-form__attack-head">
                <span>Ataque {position}</span>
                <Button variant="ghost" type="button" aria-label={`Remover ataque ${attack.name.trim() || position}`}
                  onClick={() => onChange(attacks.filter((_, i) => i !== index))}>
                  <Trash size={18} aria-hidden="true" />
                </Button>
              </div>
              <div className="sheet-form__attack-fields">
                <Field className="sheet-form__attack-name" label="Nome" value={attack.name}
                  aria-invalid={Boolean(error) && attack.name.trim().length === 0}
                  onChange={(e) => update(index, { name: e.target.value })} />
                <SelectField label="Bônus Atq/CD" value={attack.kind}
                  onChange={(value) => update(index, { kind: value as FormAttack['kind'] })}>
                  <option value="attack">Bônus de ataque</option>
                  <option value="save">CD de resistência</option>
                </SelectField>
                {attack.kind === 'attack' ? (
                  <Field label="Bônus" type="number" min={-MAX_BONUS} max={MAX_BONUS} value={attack.bonus}
                    hint="Rola 1d20 + bônus contra a CA"
                    aria-invalid={Boolean(error) && (!Number.isInteger(bonus) || Math.abs(bonus) > MAX_BONUS)}
                    onChange={(e) => update(index, { bonus: e.target.value })} />
                ) : (
                  <>
                    <Field label="CD" type="number" min={SAVE_DC.min} max={SAVE_DC.max} value={attack.dc}
                      hint="O alvo faz o teste contra ela"
                      aria-invalid={Boolean(error) && (!Number.isInteger(dc) || dc < SAVE_DC.min || dc > SAVE_DC.max)}
                      onChange={(e) => update(index, { dc: e.target.value })} />
                    <SelectField label="Atributo da resistência" value={attack.saveAbility}
                      invalid={Boolean(error) && !attack.saveAbility}
                      onChange={(value) => update(index, { saveAbility: value as Ability | '' })}>
                      <option value="">Escolha…</option>
                      {ABILITIES.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}
                    </SelectField>
                  </>
                )}
                <Field label="Dano" hint="Ex.: 1d8+3 ou 1d8+3+1d6" autoComplete="off" spellCheck={false} value={attack.damage}
                  aria-invalid={Boolean(error) && !parseDiceExpression(attack.damage)}
                  onChange={(e) => update(index, { damage: e.target.value })} />
                <Field label="Tipo de dano" maxLength={CHARACTER_LIMITS.damageType} value={attack.damageType} hint="Ex.: Cortante"
                  onChange={(e) => update(index, { damageType: e.target.value })} />
                <Field className="sheet-form__attack-name" label="Notas" maxLength={CHARACTER_LIMITS.attackNotes} value={attack.notes}
                  hint={notesHint}
                  onChange={(e) => update(index, { notes: e.target.value })} />
              </div>
            </div>
          );
        })}
        <div>
          <Button variant="secondary" type="button" onClick={() => onChange([...attacks, emptyFormAttack()])}>
            <Plus size={18} aria-hidden="true" /> Adicionar ataque
          </Button>
        </div>
      </div>
    </>
  );
}
