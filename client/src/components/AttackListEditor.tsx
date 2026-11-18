import { Plus, Trash } from '@phosphor-icons/react';
import { ABILITIES, ATTACK_COSTS, CHARACTER_LIMITS, parseDiceExpression, type Ability, type AttackCost, type SaveEffect } from '@quest-fast/shared';
import { Button } from './Button';
import { Field } from './Field';
import { SelectField } from './SelectField';
import { ABILITY_LABELS } from '../lib/5e';
import { ATTACK_COST_LABELS } from '../lib/combat-labels';
import { emptyFormAttack, numberValue, withKind, type FormAttack } from '../lib/form-attacks';
import { attackFields, itemCard, itemHead, wideField } from './form-styles';

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
  const replace = (index: number, change: (attack: FormAttack) => FormAttack) =>
    onChange(attacks.map((attack, i) => (i === index ? change(attack) : attack)));
  const update = (index: number, patch: Partial<FormAttack>) => replace(index, (attack) => ({ ...attack, ...patch }));
  return (
    <>
      {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
      <div className="grid gap-3">
        {attacks.map((attack, index) => {
          const position = index + 1;
          const bonus = numberValue(attack.bonus);
          const dc = numberValue(attack.dc);
          return (
            <div key={attack.rowId} className={itemCard} role="group" aria-label={`Ataque ${position}`}>
              <div className={itemHead}>
                <span>Ataque {position}</span>
                <Button variant="ghost" type="button" aria-label={`Remover ataque ${attack.name.trim() || position}`}
                  onClick={() => onChange(attacks.filter((_, i) => i !== index))}>
                  <Trash size={18} aria-hidden="true" />
                </Button>
              </div>
              <div className={attackFields}>
                <Field className={wideField} label="Nome" value={attack.name}
                  aria-invalid={Boolean(error) && attack.name.trim().length === 0}
                  onChange={(e) => update(index, { name: e.target.value })} />
                <SelectField label="Bônus Atq/CD" value={attack.kind}
                  onChange={(value) => replace(index, (row) => withKind(row, value as FormAttack['kind']))}>
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
                <SelectField label="Custo" value={attack.cost}
                  onChange={(value) => update(index, { cost: value as AttackCost })}>
                  {ATTACK_COSTS.map((cost) => <option key={cost} value={cost}>{ATTACK_COST_LABELS[cost]}</option>)}
                </SelectField>
                <Field label="Dano" autoComplete="off" spellCheck={false} value={attack.damage}
                  hint={attack.kind === 'save' ? 'Ex.: 8d6. Vazio se só impõe o efeito' : 'Ex.: 1d8+3 ou 1d8+3+1d6'}
                  aria-invalid={Boolean(error) && !(attack.kind === 'save' && attack.damage.trim() === '') && !parseDiceExpression(attack.damage)}
                  onChange={(e) => update(index, { damage: e.target.value })} />
                {attack.kind === 'save' && attack.damage.trim() !== '' && (
                  <SelectField label="Se passar" value={attack.onSave}
                    onChange={(value) => update(index, { onSave: value as SaveEffect })}>
                    <option value="half">Metade do dano</option>
                    <option value="none">Nenhum dano</option>
                  </SelectField>
                )}
                <Field label="Tipo de dano" maxLength={CHARACTER_LIMITS.damageType} value={attack.damageType} hint="Ex.: Cortante"
                  onChange={(e) => update(index, { damageType: e.target.value })} />
                <Field className={wideField} label="Notas" maxLength={CHARACTER_LIMITS.attackNotes} value={attack.notes}
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
