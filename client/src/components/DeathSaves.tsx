import type { DeathSaves as DeathSavesValue } from '@quest-fast/shared';

const MARKS = [0, 1, 2] as const;

function Track({ label, kind, count, editable, pending, onChange }: {
  label: string;
  kind: 'success' | 'failure';
  count: number;
  editable: boolean;
  pending: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <div className="qf-death__track" data-kind={kind} role="group" aria-label={label}>
      <span className="qf-death__label" aria-hidden="true">{label}</span>
      {MARKS.map((index) => {
        const marked = index < count;
        // Clicking the last marked box clears it; any other box marks up to it.
        const next = marked && count === index + 1 ? index : index + 1;
        return editable ? (
          <button key={index} type="button" className="qf-death__box" aria-pressed={marked} disabled={pending}
            aria-label={`${label}: ${index + 1}`} onClick={() => onChange(next)} />
        ) : (
          <span key={index} className="qf-death__box" data-marked={marked || undefined} aria-hidden="true" />
        );
      })}
      {!editable && <span className="sr-only">{count} de 3</span>}
    </div>
  );
}

/** Three successes stabilize, three failures kill; the table resolves it. */
export function DeathSaves({ value, editable = false, pending = false, onChange }: {
  value: DeathSavesValue;
  editable?: boolean;
  pending?: boolean;
  onChange?: (next: DeathSavesValue) => void;
}) {
  return (
    <section className="qf-death" aria-label="Salvaguardas contra a morte">
      <p className="qf-counter__label">Salvaguardas contra a morte</p>
      <Track label="Sucessos" kind="success" count={value.successes} editable={editable} pending={pending}
        onChange={(successes) => onChange?.({ ...value, successes })} />
      <Track label="Falhas" kind="failure" count={value.failures} editable={editable} pending={pending}
        onChange={(failures) => onChange?.({ ...value, failures })} />
    </section>
  );
}
