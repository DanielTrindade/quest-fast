import { DATA_LABELS, DATA_STATES, type DataState } from './fixtures/app';

export function DataToggle({ value, onChange }: { value: DataState; onChange: (value: DataState) => void }) {
  return (
    <div role="group" aria-label="Dados do laboratório" data-slot="data-toggle"
      className="fixed bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 gap-1 rounded-full border border-border bg-muted p-1 font-sans text-small shadow-md">
      {DATA_STATES.map((state) => (
        <button key={state} type="button" aria-pressed={value === state} onClick={() => onChange(state)}
          className="min-h-8 cursor-pointer rounded-full px-2 whitespace-nowrap text-text-secondary aria-pressed:bg-popover aria-pressed:font-semibold aria-pressed:text-foreground">
          {DATA_LABELS[state]}
        </button>
      ))}
    </div>
  );
}
