import { useId, useState, type FormEvent } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { SIZES, STATBLOCK_LIMITS as S, SUMMON_LIMITS, type CombatantView, type Size, type SummonInput } from '@quest-fast/shared';
import { SIZE_LABELS } from '../lib/sheet-labels';
import { emptySummonAttack, emptySummonDraft, summonRequest, type SummonDraft, type SummonDraftErrors } from '../lib/summon-draft';
import { Button } from './Button';
import { Field } from './Field';
import { SelectField } from './SelectField';
import { checkLabel, segmentedGroup, segmentedRadio } from './ui/segmented';

const grid = 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3';

/**
 * The player's "Invocar" (#114): a summon from a simple sheet, in the
 * running fight, from their own character. It acts right after the summoner
 * or on its own turn, may end with the summoner's concentration and may last
 * some rounds. It only asks: the server checks again and decides.
 */
export function SummonForm({ summoner, pending = false, error = null, onSummon, onCancel }: {
  /** The player's own combatant: who summons. */
  summoner: Pick<CombatantView, 'id' | 'name' | 'concentrating'>;
  pending?: boolean;
  /** The server's reason, when it refused. */
  error?: string | null;
  /** Resolves when the server accepted; the form then clears. */
  onSummon: (input: SummonInput) => Promise<unknown> | void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<SummonDraft>(emptySummonDraft);
  const [errors, setErrors] = useState<SummonDraftErrors>({});
  const set = <K extends keyof SummonDraft>(key: K, value: SummonDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const text = (key: 'name' | 'ac' | 'hp' | 'speed' | 'initiativeBonus' | 'rounds') => ({
    value: draft[key],
    error: errors[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
  });
  const setAttack = (index: number, key: 'name' | 'bonus' | 'damage' | 'damageType', value: string) =>
    set('attacks', draft.attacks.map((attack, at) => (at === index ? { ...attack, [key]: value } : attack)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Concentration only holds a summon while the summoner concentrates.
    const built = summonRequest({ ...draft, concentration: draft.concentration && summoner.concentrating }, summoner.id);
    if (!built.ok) {
      setErrors(built.errors);
      const first = Object.keys(built.errors)[0];
      // A field takes the focus; the attacks have no single one, so their group does.
      event.currentTarget.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"]:is(fieldset)`)?.focus();
      return;
    }
    setErrors({});
    try {
      await onSummon(built.request);
    } catch {
      // The screen shows the server's reason; keep what was typed.
      return;
    }
    setDraft(emptySummonDraft());
  };

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit} noValidate aria-label={`Invocar com ${summoner.name}`}>
      <div className={grid}>
        <div data-field="name" className="col-span-full grid min-w-0">
          <Field label="Nome da invocação" required maxLength={S.name} placeholder="Espírito do Construto" {...text('name')} />
        </div>
        <div data-field="ac"><Field label="CA" required type="number" inputMode="numeric" {...text('ac')} /></div>
        <div data-field="hp"><Field label="PV" required type="number" inputMode="numeric" {...text('hp')} /></div>
        <div data-field="speed"><Field label="Deslocamento (m)" required inputMode="decimal" {...text('speed')} /></div>
        <div data-field="initiativeBonus"><Field label="Bônus de iniciativa" type="number" inputMode="numeric" {...text('initiativeBonus')} /></div>
        <div data-field="size">
          <SelectField label="Tamanho" value={draft.size} onChange={(size) => set('size', size as Size)}>
            {SIZES.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}
          </SelectField>
        </div>
      </div>

      <fieldset data-field="attacks" tabIndex={-1} className="m-0 grid min-w-0 gap-3 border-0 p-0 focus-visible:outline-2 focus-visible:outline-ring"
        aria-describedby={errors.attacks ? `${id}-attacks` : undefined}>
        <legend className="mb-2 p-0 text-small font-semibold text-text-secondary">Ataques</legend>
        {draft.attacks.length === 0 && <p className="m-0 text-small text-text-muted">Sem ataques: a invocação só se move e ajuda.</p>}
        <ul className="m-0 grid list-none gap-3 p-0">
          {draft.attacks.map((attack, index) => (
            <li key={attack.key} className="grid min-w-0 gap-2 rounded-control border border-border p-3">
              <div className={grid}>
                <div className="col-span-full grid min-w-0">
                  <Field label={`Nome do ataque ${index + 1}`} value={attack.name} onChange={(event) => setAttack(index, 'name', event.target.value)} />
                </div>
                <Field label="Bônus" type="number" inputMode="numeric" value={attack.bonus} onChange={(event) => setAttack(index, 'bonus', event.target.value)} />
                <Field label="Dano" placeholder="1d8+4" value={attack.damage} onChange={(event) => setAttack(index, 'damage', event.target.value)} />
                <Field label="Tipo de dano" value={attack.damageType} onChange={(event) => setAttack(index, 'damageType', event.target.value)} />
              </div>
              <div>
                <Button type="button" variant="ghost" onClick={() => set('attacks', draft.attacks.filter((_, at) => at !== index))}>
                  <Trash size={18} aria-hidden="true" /> Remover ataque {index + 1}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {errors.attacks && <p id={`${id}-attacks`} className="m-0 text-small text-danger-text">{errors.attacks}</p>}
        {draft.attacks.length < S.attacks && (
          <div>
            <Button type="button" variant="secondary" onClick={() => set('attacks', [...draft.attacks, emptySummonAttack()])}>
              <Plus size={18} aria-hidden="true" /> Adicionar ataque
            </Button>
          </div>
        )}
      </fieldset>

      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0">
        <legend className="mb-2 p-0 text-small font-semibold text-text-secondary">Na iniciativa</legend>
        <div className={segmentedGroup} role="radiogroup" aria-label="Na iniciativa">
          <label className={segmentedRadio}>
            <input type="radio" name={`${id}-initiative`} checked={draft.initiativeMode === 'withSummoner'}
              onChange={() => set('initiativeMode', 'withSummoner')} />
            <span>Logo depois de {summoner.name}</span>
          </label>
          <label className={segmentedRadio}>
            <input type="radio" name={`${id}-initiative`} checked={draft.initiativeMode === 'own'} onChange={() => set('initiativeMode', 'own')} />
            <span>Na própria vez</span>
          </label>
        </div>
        <label className={checkLabel}>
          <input type="checkbox" checked={draft.concentration && summoner.concentrating} disabled={!summoner.concentrating}
            onChange={(event) => set('concentration', event.target.checked)} />
          {summoner.concentrating ? `Some quando ${summoner.name} perder a concentração` : `${summoner.name} não está concentrando`}
        </label>
        <div data-field="rounds" className="max-w-56">
          <Field label="Duração em rodadas (opcional)" type="number" inputMode="numeric" min={SUMMON_LIMITS.rounds.min}
            max={SUMMON_LIMITS.rounds.max} hint="Vazio: até alguém dispensar ou o combate acabar." {...text('rounds')} />
        </div>
        {errors.link && <p className="m-0 text-small text-danger-text">{errors.link}</p>}
      </fieldset>

      {error && <p role="alert" className="m-0 text-small text-danger-text">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={pending} className="max-w-full whitespace-normal">
          <Plus size={18} aria-hidden="true" /> Invocar
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}
