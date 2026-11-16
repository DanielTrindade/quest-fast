import { useId, useState } from 'react';
import { Check, MagicWand, X } from '@phosphor-icons/react';
import { canCastAsRitual, castBlockedReason, castCircles, type CastChoice, type Spell, type SpellSlot } from '@quest-fast/shared';
import { contentKeys } from '../lib/content-keys';
import { circleLabel } from '../lib/sheet-labels';
import { Button } from './Button';
import { SpellSlots } from './SpellSlots';
import { sheetItem } from './sheet-styles';
import { segmentedGroup, segmentedRadio } from './ui/segmented';

type Option = { value: string; label: string; choice: CastChoice };

function optionsFor(spell: Spell, slots: readonly SpellSlot[]): Option[] {
  const circles = castCircles(spell, slots).map((circle) => ({ value: String(circle), label: circleLabel(circle), choice: { circle } }));
  return canCastAsRitual(spell) ? [...circles, { value: 'ritual', label: 'Como ritual', choice: { ritual: true } }] : circles;
}

/**
 * The confirmation under a spell: which slot it takes (the lowest free one
 * first, or the ritual), what happens to concentration, then confirm or
 * cancel. Nothing is spent before the confirmation.
 */
function CastConfirm({ spell, slots, concentrating, pending, onCast, onCancel }: {
  spell: Spell;
  slots: readonly SpellSlot[];
  concentrating: boolean;
  pending: boolean;
  onCast: (choice: CastChoice) => void;
  onCancel: () => void;
}) {
  const group = useId();
  const options = optionsFor(spell, slots);
  const [picked, setPicked] = useState(options[0]?.value ?? '');
  const chosen = options.find((option) => option.value === picked) ?? options[0];
  return (
    <div role="group" aria-label={`Conjurar ${spell.name}`} className="grid min-w-0 gap-3 border-t border-border pt-3">
      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-small text-text-secondary">Espaço a gastar</legend>
        <div className={segmentedGroup}>
          {options.map((option) => (
            <label key={option.value} className={segmentedRadio}>
              <input type="radio" name={group} value={option.value} checked={chosen?.value === option.value}
                disabled={pending} onChange={() => setPicked(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {spell.concentration && (
        <p className="m-0 text-small text-text-secondary">
          {concentrating
            ? 'Exige concentração: a concentração atual termina.'
            : 'Exige concentração: o personagem passa a se concentrar.'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!chosen} loading={pending} onClick={() => chosen && onCast(chosen.choice)}>
          <Check size={18} aria-hidden="true" /> Conjurar<span className="sr-only"> {spell.name}</span>
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onCancel}>
          <X size={18} aria-hidden="true" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * The spell slots and the spells that spend them, at hand during play. The
 * pips adjust a slot by hand; "Conjurar" spends one through the server,
 * which also tells the table. Cantrips spend nothing and are left out.
 */
export function SpellCaster({ name, slots, spells, concentrating, pending = false, error = null, onChangeSlots, onCast }: {
  /** Whose spells: names the controls for screen readers. */
  name: string;
  slots: readonly SpellSlot[];
  spells: readonly Spell[];
  concentrating: boolean;
  pending?: boolean;
  error?: string | null;
  onChangeSlots: (spent: number[]) => void;
  /** The spell's index in the sheet's list, as the server reads it. */
  onCast: (spellIndex: number, choice: CastChoice) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const ids = useId();
  const castable = contentKeys(spells)
    .map((entry, index) => ({ ...entry, index }))
    .filter(({ item }) => item.level >= 1);
  return (
    <section aria-label={`Magias de ${name}`} className="grid min-w-0 gap-3">
      <h4 className="m-0 text-small font-semibold text-text-secondary">Magia</h4>
      <SpellSlots slots={slots} editable pending={pending} onChange={onChangeSlots} />
      {castable.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {castable.map(({ item: spell, key, index }) => {
            const blocked = castBlockedReason(spell, slots);
            return (
              <li key={key} className={sheetItem}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-semibold [overflow-wrap:anywhere]">{spell.name}</span>
                    <span className="text-small text-text-secondary">
                      {circleLabel(spell.level)}{spell.concentration ? ' · concentração' : ''}{spell.ritual ? ' · ritual' : ''}
                    </span>
                  </span>
                  {open !== index && (
                    <Button variant="secondary" disabled={pending || blocked !== null} onClick={() => setOpen(index)}
                      aria-describedby={blocked ? `${ids}-blocked-${index}` : undefined}>
                      <MagicWand size={18} aria-hidden="true" /> Conjurar<span className="sr-only"> {spell.name}</span>
                    </Button>
                  )}
                </div>
                {blocked && <p id={`${ids}-blocked-${index}`} className="m-0 text-small text-text-muted">{blocked}</p>}
                {open === index && !blocked && (
                  <CastConfirm spell={spell} slots={slots} concentrating={concentrating} pending={pending}
                    onCast={(choice) => { onCast(index, choice); setOpen(null); }} onCancel={() => setOpen(null)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert" className="m-0 text-small text-danger-text">{error}</p>}
    </section>
  );
}
