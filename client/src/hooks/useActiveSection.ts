import { useEffect, useState } from 'react';

/**
 * Tracks which section of a scrollable page is currently in view, so the
 * campaign navigation can highlight it. Returns the id of the target element
 * (e.g. `dice-title`). Uses IntersectionObserver, never a scroll listener.
 *
 * The campaign renders its sections only after its queries resolve, so
 * targets missing on mount are picked up by a MutationObserver as they appear.
 */
export function useActiveSection(sectionIds: readonly string[]): string {
  const [active, setActive] = useState('');
  // A stable dependency even when the caller passes a fresh array each render.
  const key = sectionIds.join('|');

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (ids.length === 0) return;
    const visible = new Set<string>();
    const observed = new Set<string>();

    const intersections = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const inBand = ids
          .filter((id) => visible.has(id))
          .map((id) => document.getElementById(id))
          .filter((element): element is HTMLElement => element !== null)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (inBand) {
          setActive(inBand.id);
          return;
        }
        // Between two headings the last highlight stays; before the first
        // scroll, the first target on screen gets it.
        const onScreen = ids
          .map((id) => document.getElementById(id))
          .find((element) => element && element.getBoundingClientRect().top < window.innerHeight);
        setActive((current) => current || (onScreen?.id ?? ''));
      },
      { rootMargin: '-10% 0px -55% 0px' },
    );

    const scan = () => {
      for (const id of ids) {
        if (observed.has(id)) continue;
        const element = document.getElementById(id);
        if (!element) continue;
        observed.add(id);
        intersections.observe(element);
      }
      return observed.size === ids.length;
    };

    let mutations: MutationObserver | undefined;
    if (!scan()) {
      mutations = new MutationObserver(() => {
        if (scan()) mutations?.disconnect();
      });
      mutations.observe(document.body, { childList: true, subtree: true });
    }

    // Following an anchor marks its section at once, before the scroll lands.
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (ids.includes(id)) setActive(id);
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
      intersections.disconnect();
      mutations?.disconnect();
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [key]);

  return active;
}
