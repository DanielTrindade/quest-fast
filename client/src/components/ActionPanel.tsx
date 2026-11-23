import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CaretDoubleRight } from '@phosphor-icons/react';
import { PANEL_TABS } from './panel-tabs';
import { unreadLabel } from '../lib/chat-compose';
import { cn } from '../lib/utils';
import { Tooltip, TooltipProvider } from './Tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export type ActionPanelTab = 'map' | 'actions' | 'dice' | 'feed' | 'chat';

/**
 * A dot next to the tab label, with its reason spelled out for screen
 * readers. `alert` is a hit waiting on the master; `turn` is the viewer's
 * own turn.
 */
export type ActionPanelSignal = { tone: 'turn' | 'alert'; label: string; count?: number };

/** Messages the reader has not seen yet, and whether one of them names them. */
export type ChatUnread = { count: number; mention: boolean };

export function Signal({ signal }: { signal: ActionPanelSignal }) {
  return (
    <span data-tone={signal.tone}
      className="inline-flex min-w-2 items-center justify-center rounded-full text-micro font-semibold tabular-nums data-[tone=alert]:text-danger-text data-[tone=turn]:text-accent-text">
      {signal.count === undefined
        ? <span aria-hidden="true" className="size-2 rounded-full bg-current" />
        : <span aria-hidden="true" className="font-mono">{signal.count}</span>}
      <span className="sr-only"> ({signal.label})</span>
    </span>
  );
}

/** The unread count of the chat: quieter than the turn, accent only with a mention. Nothing blinks. */
function Unread({ unread }: { unread: ChatUnread }) {
  return (
    <span data-slot="chat-unread" data-mention={unread.mention || undefined}
      className="font-mono text-micro tabular-nums text-text-secondary data-[mention]:font-semibold data-[mention]:text-accent-text">
      <span aria-hidden="true">{unread.count > 99 ? '99+' : unread.count}</span>
      <span className="sr-only"> ({unreadLabel(unread.count, unread.mention)})</span>
    </span>
  );
}



const TABS = PANEL_TABS;

/** Below this width of the panel the tabs keep only their icons. */
const COMPACT_BELOW = 330;

/** Whether the panel is narrower than `COMPACT_BELOW`, measured on itself. */
function useNarrow() {
  const ref = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width + 24 < COMPACT_BELOW);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, narrow };
}

/**
 * The side panel of the table: whose turn it is on top, always in sight,
 * then Ações, Dados, Feed and Chat. A panel mounts the first time it is shown
 * and then stays mounted while hidden, so a typed expression, a scrolled feed
 * or the chat's place survive a tab switch. Mounting it hidden would lay the
 * feed out in a box with no height, and it would open on its oldest events.
 * Without `feed` the tab is gone: the feed is already in the middle of the
 * screen; without `chat`, so is the chat's.
 *
 * With the chat open the panel stops growing with its content: the chat
 * takes the height left (`data-slot=chat-tab`, 70% of the screen unless the
 * page gives the panel a height) and scrolls inside. Narrow, the tabs show
 * only their icons, with the name in the tooltip and for screen readers.
 *
 * On the full screen the same panel gains Mapa (what the stage's column held:
 * the master's tools, the selected token, the turn and the token list), a
 * "Recolher painel" button, and `fill`: it takes the height it is given and
 * every tab scrolls inside it.
 */
export function ActionPanel({ header, map, actions, dice, feed, chat, tab, onTabChange, actionsSignal, chatUnread, compact, fill = false, onCollapse, className }: {
  header?: ReactNode;
  /** The map's tab, on the full screen only. */
  map?: ReactNode;
  actions: ReactNode;
  dice: ReactNode;
  feed?: ReactNode;
  chat?: ReactNode;
  tab: ActionPanelTab;
  onTabChange: (tab: ActionPanelTab) => void;
  actionsSignal?: ActionPanelSignal | null;
  chatUnread?: ChatUnread | null;
  /** Icons only, whatever the width (the full screen's five tabs). */
  compact?: boolean;
  /** Takes the height it is given; each tab scrolls inside. */
  fill?: boolean;
  /** Shows "Recolher painel" on top. */
  onCollapse?: () => void;
  className?: string;
}) {
  const content: Record<ActionPanelTab, ReactNode> = { map, actions, dice, feed, chat };
  const tabs = TABS.filter(({ id }) => content[id] !== undefined || id === 'actions' || id === 'dice');
  const current = tabs.some(({ id }) => id === tab) ? tab : 'actions';
  const [shown, setShown] = useState<ReadonlySet<ActionPanelTab>>(() => new Set([current]));
  if (!shown.has(current)) setShown(new Set(shown).add(current));
  const { ref, narrow } = useNarrow();
  const iconsOnly = compact ?? narrow;

  return (
    <aside ref={ref} aria-label="Painel da mesa" data-tab={current}
      className={cn('flex min-w-0 flex-col gap-3 rounded-panel border border-border-strong bg-card p-3 edge-raised', className)}>
      {onCollapse && (
        <div className="-mb-1 flex justify-end">
          <button type="button" onClick={onCollapse} data-slot="panel-collapse"
            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-control px-2 text-small text-text-secondary transition-[color,background-color,scale] duration-(--duration-quick) ease-settle hover:bg-surface-secret hover:text-foreground motion-safe:active:scale-[0.97]">
            Recolher painel <CaretDoubleRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {header}
      <Tabs value={current} onValueChange={(value) => onTabChange(value as ActionPanelTab)} 
        // Only the chat fills the panel; any other tab keeps its own height, so
        // a panel with a height cap scrolls instead of squeezing it.
        className={cn('min-w-0 gap-3', current === 'chat' || fill ? 'min-h-0 flex-1' : 'flex-none')}>
        {/* Its own provider: the tooltips only exist with icons alone, wherever the panel is. */}
        <TooltipProvider>
          <TabsList aria-label="Seções do painel" className="w-full">
            {tabs.map(({ id, label, icon: Icon }) => {
              const trigger = (
                <TabsTrigger value={id} className={cn(iconsOnly && 'gap-1 px-2')}>
                  <Icon size={16} aria-hidden="true" />
                  <span className={cn(iconsOnly && 'sr-only')}>{label}</span>
                  {id === 'actions' && actionsSignal && <Signal signal={actionsSignal} />}
                  {id === 'chat' && chatUnread && chatUnread.count > 0 && <Unread unread={chatUnread} />}
                </TabsTrigger>
              );
              // Always wrapped, only switched off: swapping the wrapper would remount
              // the tab and drop its focus when the panel crosses the width.
              return <Tooltip key={id} label={label} side="bottom" disabled={!iconsOnly}>{trigger}</Tooltip>;
            })}
          </TabsList>
        </TooltipProvider>
        {tabs.map(({ id }) => (
          <TabsContent key={id} value={id} forceMount data-slot={id === 'chat' ? 'chat-tab' : undefined}
            className={cn(
              'min-w-0 data-[state=inactive]:hidden',
              id === 'chat' && (fill ? 'flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1' : 'flex h-[70dvh] max-h-[44rem] min-h-80 flex-col [&>*]:min-h-0 [&>*]:flex-1'),
              id !== 'chat' && 'grid grid-cols-[minmax(0,1fr)] content-start gap-4',
              id !== 'chat' && fill && 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            )}>
            {shown.has(id) && content[id]}
          </TabsContent>
        ))}
      </Tabs>
      <div aria-hidden="true" data-slot="panel-fade" className="pointer-events-none sticky bottom-0 -mt-3 hidden h-8 flex-none bg-linear-to-t from-card to-transparent" />
    </aside>
  );
}
