import type { ReactNode } from 'react';
import { DiceFive, Lightning, Scroll } from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export type ActionPanelTab = 'actions' | 'dice' | 'feed';

/**
 * A dot next to the tab label, with its reason spelled out for screen
 * readers. `alert` is a hit waiting on the master; `turn` is the viewer's
 * own turn.
 */
export type ActionPanelSignal = { tone: 'turn' | 'alert'; label: string; count?: number };

function Signal({ signal }: { signal: ActionPanelSignal }) {
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

const TABS = [
  { id: 'actions', label: 'Ações', icon: Lightning },
  { id: 'dice', label: 'Dados', icon: DiceFive },
  { id: 'feed', label: 'Feed', icon: Scroll },
] as const;

/**
 * The side panel of the table: whose turn it is on top, always in sight,
 * then Ações, Dados and Feed. The panels stay mounted while hidden, so a
 * typed expression or a scrolled feed survive a tab switch. Without `feed`
 * the tab is gone: the feed is already in the middle of the screen.
 */
export function ActionPanel({ header, actions, dice, feed, tab, onTabChange, actionsSignal, className }: {
  header?: ReactNode;
  actions: ReactNode;
  dice: ReactNode;
  feed?: ReactNode;
  tab: ActionPanelTab;
  onTabChange: (tab: ActionPanelTab) => void;
  actionsSignal?: ActionPanelSignal | null;
  className?: string;
}) {
  const content: Record<ActionPanelTab, ReactNode> = { actions, dice, feed };
  const tabs = TABS.filter(({ id }) => id !== 'feed' || feed !== undefined);
  const current = tabs.some(({ id }) => id === tab) ? tab : 'actions';

  return (
    <aside aria-label="Painel da mesa"
      className={cn('grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-panel border border-border-strong bg-card p-3 edge-raised', className)}>
      {header}
      <Tabs value={current} onValueChange={(value) => onTabChange(value as ActionPanelTab)} className="min-h-0 min-w-0 gap-3">
        <TabsList aria-label="Seções do painel" className="w-full">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon size={16} aria-hidden="true" />
              {label}
              {id === 'actions' && actionsSignal && <Signal signal={actionsSignal} />}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ id }) => (
          <TabsContent key={id} value={id} forceMount className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 data-[state=inactive]:hidden">
            {content[id]}
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}
