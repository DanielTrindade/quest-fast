import { CaretDoubleLeft } from '@phosphor-icons/react';
import { unreadLabel } from '../lib/chat-compose';
import { cn } from '../lib/utils';
import { Signal, type ActionPanelSignal, type ActionPanelTab, type ChatUnread } from './ActionPanel';
import { PANEL_TABS } from './panel-tabs';
import { Tooltip, TooltipProvider } from './Tooltip';

// Square, but it may give a little width on a 320 px bar.
const railButton = 'relative inline-flex size-10 min-w-8 shrink cursor-pointer items-center justify-center rounded-control text-text-secondary transition-[color,background-color,scale] duration-(--duration-quick) ease-settle hover:bg-surface-secret hover:text-foreground motion-safe:active:scale-[0.97]';

/** The chat's count on the rail: a small pill, in `accent` when it names the reader. */
function RailUnread({ unread }: { unread: ChatUnread }) {
  return (
    <span data-slot="rail-unread" data-mention={unread.mention || undefined}
      className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full border border-card bg-surface-secret px-1 text-center font-mono text-micro leading-4 tabular-nums text-text-secondary data-[mention]:bg-accent data-[mention]:font-semibold data-[mention]:text-accent-fg">
      {unread.count > 99 ? '99+' : unread.count}
    </span>
  );
}

/**
 * The table panel put away on the full screen: one icon per tab and one to
 * expand, about 52 px. Ações keeps its dot of turn or pending damage, and
 * Chat its unread count. A tab's icon opens the panel on it. Vertical beside
 * the map by default; `className` turns it into a bar under a narrow map.
 */
export function PanelRail({ tabs, onOpen, actionsSignal, chatUnread, className }: {
  tabs: readonly ActionPanelTab[];
  /** `undefined` expands on the tab the panel had. */
  onOpen: (tab?: ActionPanelTab) => void;
  actionsSignal?: ActionPanelSignal | null;
  chatUnread?: ChatUnread | null;
  className?: string;
}) {
  const present = new Set(tabs);
  return (
    <TooltipProvider>
      <nav aria-label="Painel da mesa recolhido" data-slot="panel-rail"
        className={cn('flex min-w-0 items-center gap-1 rounded-panel border border-border-strong bg-card p-1.5 edge-raised', className)}>
        {PANEL_TABS.filter(({ id }) => present.has(id)).map(({ id, label, icon: Icon }) => {
          const unread = id === 'chat' && chatUnread && chatUnread.count > 0 ? chatUnread : null;
          return (
            <Tooltip key={id} label={label} side="left">
              <button type="button" className={railButton} onClick={() => onOpen(id)}
                aria-label={unread ? `${label} (${unreadLabel(unread.count, unread.mention)})`
                  : id === 'actions' && actionsSignal ? `${label} (${actionsSignal.label})` : label}>
                <Icon size={20} aria-hidden="true" />
                {id === 'actions' && actionsSignal && (
                  <span className="absolute top-1 right-1"><Signal signal={actionsSignal} /></span>
                )}
                {unread && <RailUnread unread={unread} />}
              </button>
            </Tooltip>
          );
        })}
        {/* Expandir goes to the far end: the bottom of a column, the right of a bar. */}
        <span aria-hidden="true" className="flex-1" />
        <Tooltip label="Expandir painel" side="left">
          <button type="button" className={railButton} aria-label="Expandir painel" onClick={() => onOpen()}>
            <CaretDoubleLeft size={20} aria-hidden="true" />
          </button>
        </Tooltip>
      </nav>
    </TooltipProvider>
  );
}
