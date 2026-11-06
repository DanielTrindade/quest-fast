import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown } from '@phosphor-icons/react';
import { Button } from './Button';

/**
 * The live feed surface: a scroll viewport (height-capped on desktop by the
 * container query), a "load more" for the paginated past and a pill counting
 * events that arrived while the table read something older.
 *
 * `ids` lists the events oldest first. Only events after the last one the
 * reader saw are counted as new, so loading the past never moves the count.
 */
export function FeedFollow({ children, ids, hasMore, onLoadMore, loadingMore = false, loadMoreError = null }: {
  children: ReactNode;
  ids: readonly string[];
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  loadMoreError?: string | null;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<string | undefined>(undefined);
  const previous = useRef<{ count: number; newestId: string | undefined; scrollHeight: number } | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [seenId, setSeenId] = useState<string | undefined>(undefined);

  const count = ids.length;
  const newestId = ids.at(-1);
  const seenIndex = seenId === undefined ? -1 : ids.indexOf(seenId);
  const unseen = atEnd || seenIndex < 0 ? 0 : count - 1 - seenIndex;

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

    if (!atEnd) return;
    if (scrollable) viewport.scrollTop = viewport.scrollHeight;
    else endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count, newestId, atEnd]);

  const jumpToEnd = () => {
    endRef.current?.scrollIntoView({ block: 'end' });
    setAtEnd(true);
    setSeenId(newestId);
  };

  return (
    <div className="qf-feed-follow">
      {hasMore ? (
        <div className="qf-feed-follow__loadmore">
          <Button variant="secondary" loading={loadingMore} onClick={onLoadMore}>
            {loadMoreError ? 'Tentar novamente' : 'Ver mais'}
          </Button>
          {loadMoreError && <p role="alert" className="text-small text-danger-text">{loadMoreError}</p>}
        </div>
      ) : (
        <p className="qf-feed-follow__start">Início do histórico</p>
      )}
      <div className="qf-feed-follow__viewport" ref={viewportRef}>
        {children}
        <div className="qf-feed-follow__end" ref={endRef} aria-hidden="true" />
      </div>
      <div className="qf-feed-follow__notice" aria-live="polite">
        {unseen > 0 && (
          <button type="button" className="qf-feed-follow__pill" onClick={jumpToEnd}>
            <ArrowDown size={14} aria-hidden="true" />
            {unseen} {unseen === 1 ? 'novo resultado' : 'novos resultados'}
          </button>
        )}
      </div>
    </div>
  );
}
