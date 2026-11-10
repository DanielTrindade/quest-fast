import { Sparkle } from '@phosphor-icons/react';
import { trackerLabel, trackerPanel } from './sheet-styles';
import { Button } from './ui/button';

/** Heroic inspiration: the owner toggles it; everyone else reads it. */
export function HeroicInspiration({ active, editable = false, pending = false, onChange }: {
  active: boolean;
  editable?: boolean;
  pending?: boolean;
  onChange?: (active: boolean) => void;
}) {
  return (
    <section className={trackerPanel} aria-label="Inspiração heroica">
      <p className={trackerLabel}>Inspiração heroica</p>
      {editable ? (
        <Button variant="secondary" aria-pressed={active} disabled={pending} onClick={() => onChange?.(!active)}
          className="w-fit max-w-full whitespace-normal aria-pressed:border-accent-text aria-pressed:font-semibold aria-pressed:text-accent-text">
          <Sparkle size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
          {active ? 'Inspirado' : 'Sem inspiração'}
        </Button>
      ) : (
        <p data-active={active || undefined} className="m-0 inline-flex items-center gap-2 text-text-secondary data-active:font-semibold data-active:text-accent-text">
          <Sparkle size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
          {active ? 'Inspirado' : 'Sem inspiração'}
        </p>
      )}
    </section>
  );
}
