import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** A malformed percent-escape in the hash must not throw during navigation. */
function decodeHashId(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

// The reading band, as fractions of the viewport height.
const BAND_TOP = 0.1;
const BAND_BOTTOM = 0.45;
// Side-by-side columns put headings a few pixels apart; those count as level,
// and the one earlier in the navigation wins.
const LEVEL_PX = 32;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

/**
 * Watches the given section ids until the returned function is called.
 *
 * Following a link pins its section until the reader scrolls by hand (wheel,
 * touch, keys or the scrollbar). The link's own scroll fires none of those, so
 * neither the headings it passes nor a neighbour left in the band where it
 * lands (a section near the end cannot reach the top) can replace it.
 */
function watchSections(ids: readonly string[], setActive: Dispatch<SetStateAction<string>>): () => void {
  let pinned = false;
  let frame = 0;
  const mutations = new MutationObserver(() => schedule());

  const pick = () => {
    frame = 0;
    if (pinned) return;
    const found = ids.map((id) => document.getElementById(id)).filter((element) => element !== null);
    if (found.length === 0) return;
    mutations.disconnect();
    const bandTop = window.innerHeight * BAND_TOP;
    const bandBottom = window.innerHeight * BAND_BOTTOM;
    let best: { id: string; top: number } | undefined;
    for (const element of found) {
      const top = element.getBoundingClientRect().top;
      if (top < bandTop || top > bandBottom) continue;
      if (!best || top < best.top - LEVEL_PX) best = { id: element.id, top };
    }
    if (best) {
      setActive(best.id);
      return;
    }
    // Between two headings the last highlight stays; before the first
    // scroll, the first target on screen gets it.
    const onScreen = found.find((element) => element.getBoundingClientRect().top < window.innerHeight);
    setActive((current) => current || (onScreen?.id ?? ''));
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(pick);
  };

  const unpin = () => {
    pinned = false;
  };
  const pin = (id: string) => {
    pinned = true;
    setActive(id);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) unpin();
  };
  // A click on the link already in the hash fires no hashchange, so clicks are
  // read directly; hashchange still covers back and forward.
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    const id = link ? decodeHashId(link.getAttribute('href')!.slice(1)) : '';
    if (ids.includes(id)) pin(id);
  };
  const onHashChange = () => {
    const id = decodeHashId(window.location.hash.slice(1));
    if (ids.includes(id)) pin(id);
  };

  // The sections render after their queries resolve: wait for the first one.
  mutations.observe(document.body, { childList: true, subtree: true });
  schedule();

  const passive = { passive: true } as const;
  window.addEventListener('scroll', schedule, passive);
  window.addEventListener('resize', schedule, passive);
  window.addEventListener('wheel', unpin, passive);
  window.addEventListener('touchstart', unpin, passive);
  window.addEventListener('pointerdown', unpin, passive);
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', onHashChange);

  return () => {
    cancelAnimationFrame(frame);
    mutations.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('wheel', unpin);
    window.removeEventListener('touchstart', unpin);
    window.removeEventListener('pointerdown', unpin);
    window.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onClick);
    window.removeEventListener('hashchange', onHashChange);
  };
}

/**
 * Tracks which section of a scrollable page is currently in view, so the
 * campaign navigation can highlight it. Returns the id of the target element
 * (e.g. `dice-title`).
 */
export function useActiveSection(sectionIds: readonly string[]): string {
  const [active, setActive] = useState('');
  // A stable dependency even when the caller passes a fresh array each render.
  const key = sectionIds.join('|');

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (ids.length === 0) return;
    return watchSections(ids, setActive);
  }, [key]);

  return active;
}
