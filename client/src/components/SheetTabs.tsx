import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

export type SheetTab = { id: string; label: string; hasError?: boolean };

function ids(prefix: string, id: string) {
  return { tab: `${prefix}-tab-${id}`, panel: `${prefix}-panel-${id}` };
}

/**
 * The sections of the official sheet as WAI-ARIA tabs: arrow keys, Home and
 * End move and select; only the selected tab is in the tab order. `idPrefix`
 * must be unique per instance (use `useId`), since a page can show two sheets.
 */
export function SheetTabs({ tabs, active, onChange, idPrefix, label, className = '' }: {
  tabs: readonly SheetTab[];
  active: string;
  onChange: (id: string) => void;
  idPrefix: string;
  label: string;
  className?: string;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const target = ({ ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last } as Record<string, number>)[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const tab = tabs[target];
    if (!tab) return;
    onChange(tab.id);
    buttons.current[tab.id]?.focus();
  };

  return (
    <div className={`qf-tabs ${className}`} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        const { tab: tabId, panel } = ids(idPrefix, tab.id);
        return (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={tabId}
            aria-controls={panel}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="qf-tabs__tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
            {tab.hasError && (
              <span className="qf-tabs__error">
                <WarningCircle size={14} weight="fill" aria-hidden="true" />
                <span className="sr-only"> (contém erro)</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A panel stays mounted while hidden, so typed values survive a tab switch. */
export function SheetTabPanel({ idPrefix, id, active, children }: {
  idPrefix: string;
  id: string;
  active: string;
  children: ReactNode;
}) {
  const { tab, panel } = ids(idPrefix, id);
  return (
    <div role="tabpanel" id={panel} aria-labelledby={tab} hidden={active !== id} className="qf-tabpanel">
      {children}
    </div>
  );
}
