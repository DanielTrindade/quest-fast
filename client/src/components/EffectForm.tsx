import { useId, useState, type FormEvent } from 'react';
import { DAMAGE_TYPES, EFFECT_DURATIONS, EFFECT_LIMITS, type CombatantView, type DamageType, type EffectRequest } from '@quest-fast/shared';
import { Button } from './Button';
import { Input } from './ui/input';
import { NativeSelect } from './ui/native-select';
import { checkLabel } from './ui/segmented';
import { DAMAGE_RELATIONS, DAMAGE_RELATION_LABELS, emptyEffectDraft, effectRequest, type EffectDraft } from '../lib/effect-draft';
import { DAMAGE_TYPE_LABELS, EFFECT_DURATION_LABELS } from '../lib/effect-labels';

const field = 'grid min-w-0 gap-1 text-small text-text-secondary';
const row = 'flex min-w-0 flex-wrap items-end gap-2';

export type EffectBearer = Pick<CombatantView, 'id' | 'name'>;

/**
 * Puts a temporary effect (Shield of Faith, Aid, Slow) on a combatant. The
 * effect comes from `caster`, whose panel this is: the cleric picks the
 * fighter in "Em quem". It only asks: the form checks the same rules the
 * server applies, and the server decides who may.
 */
export function EffectForm({ caster, bearers, pending = false, onApply }: {
  /** Whose spell or feature it is: its concentration can hold the effect up. */
  caster: Pick<CombatantView, 'id' | 'name' | 'concentrating'>;
  /** Who it may go on, the caster first. */
  bearers: EffectBearer[];
  pending?: boolean;
  onApply: (bearerId: string, effect: EffectRequest) => void;
}) {
  const id = useId();
  // Unpicked, the effect goes on the caster.
  const [bearerId, setBearerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EffectDraft>(emptyEffectDraft);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EffectDraft>(key: K, value: EffectDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleType = (type: DamageType, checked: boolean) =>
    set('damageTypes', checked ? [...draft.damageTypes, type] : draft.damageTypes.filter((ticked) => ticked !== type));
  // A bearer that left the fight is no longer offered.
  const target = bearerId !== null && bearers.some((bearer) => bearer.id === bearerId) ? bearerId : caster.id;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const built = effectRequest({ ...draft, concentration: draft.concentration && caster.concentrating }, caster.id);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    onApply(target, built.request);
    setDraft(emptyEffectDraft());
  };

  return (
    <form onSubmit={submit} aria-label={`Aplicar efeito de ${caster.name}`} noValidate
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className={row}>
        {bearers.length > 1 && (
          <div className={`${field} flex-[1_1_9rem]`}>
            <label htmlFor={`${id}-bearer`}>Em quem</label>
            <NativeSelect id={`${id}-bearer`} value={target} disabled={pending} onChange={(event) => setBearerId(event.target.value)}>
              {bearers.map((bearer) => <option key={bearer.id} value={bearer.id}>{bearer.name}</option>)}
            </NativeSelect>
          </div>
        )}
        <div className={`${field} flex-[2_1_11rem]`}>
          <label htmlFor={`${id}-name`}>Nome do efeito</label>
          <Input id={`${id}-name`} value={draft.name} maxLength={EFFECT_LIMITS.name} placeholder="Escudo da Fé" disabled={pending}
            onChange={(event) => set('name', event.target.value)} />
        </div>
      </div>

      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-1 text-small font-semibold text-text-secondary">O que muda</legend>
        <div className={row}>
          <div className={`${field} flex-[1_1_8rem]`}>
            <label htmlFor={`${id}-ac`}>CA</label>
            <NativeSelect id={`${id}-ac`} value={draft.acMode} disabled={pending}
              onChange={(event) => set('acMode', event.target.value as EffectDraft['acMode'])}>
              <option value="">Não muda</option>
              <option value="add">Soma</option>
              <option value="set">Fica em</option>
            </NativeSelect>
          </div>
          {draft.acMode && (
            <div className={`${field} flex-[0_1_6rem]`}>
              <label htmlFor={`${id}-ac-value`}>{draft.acMode === 'add' ? 'Bônus de CA' : 'Valor da CA'}</label>
              <Input id={`${id}-ac-value`} type="number" inputMode="numeric" value={draft.acValue} disabled={pending}
                onChange={(event) => set('acValue', event.target.value)} />
            </div>
          )}
        </div>
        <div className={row}>
          <div className={`${field} flex-[1_1_8rem]`}>
            <label htmlFor={`${id}-speed`}>Deslocamento</label>
            <NativeSelect id={`${id}-speed`} value={draft.speedMode} disabled={pending}
              onChange={(event) => set('speedMode', event.target.value as EffectDraft['speedMode'])}>
              <option value="">Não muda</option>
              <option value="add">Soma</option>
              <option value="set">Fica em</option>
              <option value="half">Cai pela metade</option>
            </NativeSelect>
          </div>
          {(draft.speedMode === 'add' || draft.speedMode === 'set') && (
            <div className={`${field} flex-[0_1_6rem]`}>
              <label htmlFor={`${id}-speed-value`}>Metros</label>
              <Input id={`${id}-speed-value`} type="number" inputMode="decimal" step={1.5} value={draft.speedValue} disabled={pending}
                onChange={(event) => set('speedValue', event.target.value)} />
            </div>
          )}
          <div className={`${field} flex-[0_1_7rem]`}>
            <label htmlFor={`${id}-hp`}>PV máximo +</label>
            <Input id={`${id}-hp`} type="number" inputMode="numeric" min={EFFECT_LIMITS.hpMax.min} max={EFFECT_LIMITS.hpMax.max}
              placeholder="0" value={draft.hpMax} disabled={pending} onChange={(event) => set('hpMax', event.target.value)} />
          </div>
        </div>
        <div className={`${field} max-w-60`}>
          <label htmlFor={`${id}-damage`}>Dano</label>
          <NativeSelect id={`${id}-damage`} value={draft.damageRelation} disabled={pending}
            onChange={(event) => set('damageRelation', event.target.value as EffectDraft['damageRelation'])}>
            <option value="">Não muda</option>
            {DAMAGE_RELATIONS.map((relation) => <option key={relation} value={relation}>{DAMAGE_RELATION_LABELS[relation]}</option>)}
          </NativeSelect>
        </div>
        {draft.damageRelation && (
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">Tipos de dano da {DAMAGE_RELATION_LABELS[draft.damageRelation].toLowerCase()}</legend>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-x-3 p-0">
              {DAMAGE_TYPES.map((type) => (
                <li key={type} className="min-w-0">
                  <label className={checkLabel}>
                    <input type="checkbox" checked={draft.damageTypes.includes(type)} disabled={pending}
                      onChange={(event) => toggleType(type, event.target.checked)} />
                    <span className="text-foreground">{DAMAGE_TYPE_LABELS[type]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </fieldset>

      <div className={row}>
        <div className={`${field} flex-[2_1_12rem]`}>
          <label htmlFor={`${id}-duration`}>Duração</label>
          <NativeSelect id={`${id}-duration`} value={draft.duration} disabled={pending}
            onChange={(event) => set('duration', event.target.value as EffectDraft['duration'])}>
            {EFFECT_DURATIONS.map((duration) => <option key={duration} value={duration}>{EFFECT_DURATION_LABELS[duration]}</option>)}
          </NativeSelect>
        </div>
        {draft.duration === 'rounds' && (
          <div className={`${field} flex-[0_1_6rem]`}>
            <label htmlFor={`${id}-rounds`}>Rodadas</label>
            <Input id={`${id}-rounds`} type="number" inputMode="numeric" min={EFFECT_LIMITS.rounds.min} max={EFFECT_LIMITS.rounds.max}
              value={draft.rounds} disabled={pending} onChange={(event) => set('rounds', event.target.value)} />
          </div>
        )}
      </div>

      <div className="grid min-w-0 gap-0.5">
        <label className={checkLabel}>
          <input type="checkbox" checked={draft.concentration && caster.concentrating} disabled={pending || !caster.concentrating}
            aria-describedby={caster.concentrating ? undefined : `${id}-concentration-hint`}
            onChange={(event) => set('concentration', event.target.checked)} />
          <span>Acaba com a concentração de {caster.name}</span>
        </label>
        {!caster.concentrating && (
          <p id={`${id}-concentration-hint`} className="m-0 text-small text-text-secondary">Marque a concentração de {caster.name} antes.</p>
        )}
      </div>

      {error && <p role="alert" className="m-0 text-small text-danger-text">{error}</p>}
      <div className="flex [&>[data-slot=button]]:flex-auto sm:[&>[data-slot=button]]:flex-none">
        <Button type="submit" variant="secondary" disabled={pending}>
          Aplicar efeito<span className="sr-only"> de {caster.name}</span>
        </Button>
      </div>
    </form>
  );
}
