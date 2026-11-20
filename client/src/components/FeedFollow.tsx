import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown } from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import { Button } from './Button';

const NEW_RESULTS = ['novo resultado', 'novos resultados'] as const;

/** The two shapes: the feed's (page flow, capped on desktop) and the chat's (fills its box). */
const SHAPE = {
  flow: {
    root: 'grid min-w-0',
    viewport: '@min-[760px]:max-h-[480px] @min-[760px]:overflow-y-auto',
    pill: 'sticky bottom-4 grid justify-items-center not-empty:pt-3',
  },
  fill: {
    // The pill takes its own row under the list, never over a line.
    root: 'grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]',
    // Its own background: lines are transparent, and the contrast of a line
    // scrolled out is measured against the box that scrolls, not the panel.
    viewport: 'min-h-0 overflow-y-auto bg-card',
    pill: 'grid justify-items-center not-empty:pt-1',
  },
} as const;

/**
 * The live feed surface: a scroll viewport (height-capped on desktop by the
 * container query), a "load more" for the paginated past and a pill counting
 * events that arrived while the table read something older.
 *
 * `ids` lists the events oldest first. Only events after the last one the
 * reader saw are counted as new, so loading the past never moves the count.
 *
 * `fill` is the chat's shape: the viewport takes the height its parent gives
 * and always scrolls inside, with the pill in a row of its own under it. A newest id
 * equal to `followId` (the reader's own message) always goes to the end.
 */
export function FeedFollow({ children, ids, hasMore, onLoadMore, loadingMore = false, loadMoreError = null, fill = false, followId, newLabel = NEW_RESULTS }: {
  children: ReactNode;
  ids: readonly string[];
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  fill?: boolean;
  followId?: string;
  /** The pill's words, singular and plural. */
  newLabel?: readonly [string, string];
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<string | undefined>(undefined);
  const previous = useRef<{ count: number; newestId: string | undefined; scrollHeight: number } | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [seenId, setSeenId] = useState<string | undefined>(undefined);
  const shape = SHAPE[fill ? 'fill' : 'flow'];

  const count = ids.length;
  const newestId = ids.at(-1);
  const seenIndex = seenId === undefined ? -1 : ids.indexOf(seenId);
  // A refetch on reconnect keeps only the latest page, which can drop the last
  // seen event: then every listed event is newer and more may be missing.
  const anchorLost = seenId !== undefined && seenIndex < 0;
  const unseen = atEnd || seenId === undefined ? 0 : anchorLost ? count : count - 1 - seenIndex;

  // The end marker is watched against the page viewport, so "at the end"
  // holds both inside the desktop scroll box and in the mobile page flow.
  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setAtEnd(entry.isIntersecting);
      setSeenId(newestRef.current);
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const before = previous.current;
    newestRef.current = newestId;
    previous.current = { count, newestId, scrollHeight: viewport?.scrollHeight ?? 0 };
    if (!viewport) return;
    const scrollable = viewport.scrollHeight > viewport.clientHeight;

    // A session opens on its latest events. Only the box scrolls: on a phone
    // the page must not jump to the feed on load.
    if (!before) {
      if (scrollable) viewport.scrollTop = viewport.scrollHeight;
      return;
    }

    if (newestId === before.newestId) {
      // Older events went in on top: keep the reader's place in the box.
      if (count > before.count && scrollable) {
        viewport.scrollTop += viewport.scrollHeight - before.scrollHeight;
      }
      return;
    }

    if (!atEnd && newestId !== followId) return;
    if (scrollable) viewport.scrollTop = viewport.scrollHeight;
    else endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count, newestId, atEnd, followId]);

  const jumpToEnd = () => {
    endRef.current?.scrollIntoView({ block: 'end' });
    setAtEnd(true);
    setSeenId(newestId);
  };

  return (
    // `data-at-end` says whether the reader is following the end, for the stories to wait on.
    <div className={shape.root} data-at-end={atEnd}>
      {hasMore ? (
        <div className="mb-3 grid justify-items-center gap-2 text-center">
          <Button variant="secondary" loading={loadingMore} onClick={onLoadMore}>
            {loadMoreError ? 'Tentar novamente' : 'Ver mais'}
          </Button>
          {loadMoreError && <p role="alert" className="text-small text-danger-text">{loadMoreError}</p>}
        </div>
      ) : (
        <p className="mb-2 text-center text-micro text-text-muted">Início do histórico</p>
      )}
      {/* Older pages are re-anchored here, so the browser's own scroll anchoring
          would move the reader twice; relative clips sr-only text to the scroller. */}
      <div ref={viewportRef} className={cn('relative grid min-w-0 content-start [overflow-anchor:none] overscroll-contain', shape.viewport)}>
        {children}
        {/* Invisible, so nothing measures it as covering the last lines it overlaps. */}
        <div ref={endRef} aria-hidden="true" className="pointer-events-none invisible -mt-8 h-8" />
      </div>
      <div aria-live="polite" className={shape.pill}>
        {unseen > 0 && (
          <button type="button" data-slot="feed-pill" onClick={jumpToEnd} className="inline-flex min-h-10 cursor-pointer items-center gap-1 justify-self-center rounded-full border border-input bg-popover px-3 py-1 text-small text-accent-text elevation-popover transition-[border-color,transform] duration-(--duration-quick) ease-settle animate-in fade-in-0 slide-in-from-bottom-2 hover:border-border-strong motion-safe:active:scale-[0.97]">
            <ArrowDown size={14} aria-hidden="true" />
            {unseen}{anchorLost && '+'} {unseen === 1 && !anchorLost ? newLabel[0] : newLabel[1]}
          </button>
        )}
      </div>
    </div>
  );
}
