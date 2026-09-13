import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown } from '@phosphor-icons/react';
import { Button } from './Button';

/**
 * The live feed surface: a scroll viewport (height-capped on desktop by the
 * container query), a "load more" for the paginated past and a pill counting
 * events that arrived while the table read something older.
 *
 * New events are told apart from older pages by `newestId`: loading the past
 * grows `count` without moving the newest event, so it is never counted as new.
 */
export function FeedFollow({ children, count, newestId, hasMore, onLoadMore, loadingMore = false, loadMoreError = null }: {
  children: ReactNode;
  count: number;
  newestId: string;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  loadMoreError?: string | null;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const atEndRef = useRef(true);
  const previous = useRef<{ count: number; newestId: string; scrollHeight: number } | null>(null);
  const [unseen, setUnseen] = useState(0);

  // The end marker is watched against the page viewport, so "at the end"
  // holds both inside the desktop scroll box and in the mobile page flow.
  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      atEndRef.current = entry.isIntersecting;
      if (entry.isIntersecting) setUnseen(0);
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const before = previous.current;
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

    if (atEndRef.current) {
      if (scrollable) viewport.scrollTop = viewport.scrollHeight;
      else endRef.current?.scrollIntoView({ block: 'nearest' });
    } else {
      setUnseen((current) => current + Math.max(1, count - before.count));
    }
  }, [count, newestId]);

  const jumpToEnd = () => {
    endRef.current?.scrollIntoView({ block: 'end' });
    setUnseen(0);
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
