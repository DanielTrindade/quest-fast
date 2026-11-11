import type { ReactNode } from 'react';
import type { DeathSaves as DeathSavesValue } from '@quest-fast/shared';
import { trackerLabel, trackerPanel } from './sheet-styles';
import { cn } from '../lib/utils';

const MARKS = [0, 1, 2] as const;

// Diamonds, like the boxes of the official sheet turned into gems.
const box = 'inline-grid shrink-0 place-items-center border-0 bg-transparent p-0 before:size-4 before:rotate-45 before:rounded-[3px] before:border-2 before:border-input before:bg-card before:transition-[background-color,border-color,scale] before:duration-(--duration-quick) before:ease-settle before:content-[""] aria-pressed:before:scale-110 data-marked:before:scale-110 group-data-[kind=success]:aria-pressed:before:border-success-text group-data-[kind=success]:aria-pressed:before:bg-success-text group-data-[kind=success]:data-marked:before:border-success-text group-data-[kind=success]:data-marked:before:bg-success-text group-data-[kind=failure]:aria-pressed:before:border-danger-text group-data-[kind=failure]:aria-pressed:before:bg-danger-text group-data-[kind=failure]:data-marked:before:border-danger-text group-data-[kind=failure]:data-marked:before:bg-danger-text';

function Track({ label, kind, count, editable, pending, onChange }: {
  label: string;
  kind: 'success' | 'failure';
  count: number;
  editable: boolean;
  pending: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <div data-kind={kind} role="group" aria-label={label} className="group flex min-w-0 flex-wrap items-center gap-x-1">
      <span className="w-full text-small text-text-secondary @[13rem]:w-auto @[13rem]:min-w-18" aria-hidden="true">{label}</span>
      {MARKS.map((index) => {
        const marked = index < count;
        // Clicking the last marked box clears it; any other box marks up to it.
        const next = marked && count === index + 1 ? index : index + 1;
        return editable ? (
          <button key={index} type="button" className={cn(box, 'size-9 cursor-pointer rounded-control hover:not-disabled:before:border-border-strong focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-60')} aria-pressed={marked} disabled={pending}
            aria-label={`${label}: ${index + 1}`} onClick={() => onChange(next)} />
        ) : (
          <span key={index} className={cn(box, 'size-7')} data-marked={marked || undefined} aria-hidden="true" />
        );
      })}
      {!editable && <span className="sr-only">{count} de 3</span>}
    </div>
  );
}

/** Three successes stabilize, three failures kill; the table resolves it. */
export function DeathSaves({ value, editable = false, pending = false, label = 'Salvaguardas contra a morte', onChange, children }: {
  value: DeathSavesValue;
  editable?: boolean;
  pending?: boolean;
  /** Names the panel; in a fight it says whose saves they are. */
  label?: string;
  onChange?: (next: DeathSavesValue) => void;
  /** What the combat adds to the same panel: the state and the roll. */
  children?: ReactNode;
}) {
  return (
    <section className={cn(trackerPanel, '@container')} aria-label={label}>
      <p className={trackerLabel}>Salvaguardas contra a morte</p>
      <Track label="Sucessos" kind="success" count={value.successes} editable={editable} pending={pending}
        onChange={(successes) => onChange?.({ ...value, successes })} />
      <Track label="Falhas" kind="failure" count={value.failures} editable={editable} pending={pending}
        onChange={(failures) => onChange?.({ ...value, failures })} />
      {children}
    </section>
  );
}
