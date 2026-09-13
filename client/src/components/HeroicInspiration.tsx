import { Sparkle } from '@phosphor-icons/react';

/** Heroic inspiration: the owner toggles it; everyone else reads it. */
export function HeroicInspiration({ active, editable = false, pending = false, onChange }: {
  active: boolean;
  editable?: boolean;
  pending?: boolean;
  onChange?: (active: boolean) => void;
}) {
  return (
    <section className="qf-inspiration" aria-label="Inspiração heroica">
      <p className="qf-counter__label">Inspiração heroica</p>
      {editable ? (
        <button type="button" className="qf-inspiration__toggle" aria-pressed={active} disabled={pending}
          onClick={() => onChange?.(!active)}>
          <Sparkle size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
          {active ? 'Inspirado' : 'Sem inspiração'}
        </button>
      ) : (
        <p className="qf-inspiration__state" data-active={active || undefined}>
          <Sparkle size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
          {active ? 'Inspirado' : 'Sem inspiração'}
        </p>
      )}
    </section>
  );
}
