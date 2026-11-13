import { useEffect, useState, type RefObject } from 'react';

/**
 * A view that fills the window and, where the browser allows it (not on an
 * iPhone, say), the whole screen. Leaving the browser's full screen (Esc, a
 * gesture) leaves the view too; with only the window filled, Esc leaves it.
 * The page behind does not scroll meanwhile, and is inert: Tab never reaches
 * a control hidden under the view. The toasts stay live, and so do dialogs,
 * which open later at the end of the page.
 */
export function useFullscreenView(viewRef: RefObject<HTMLElement | null>): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);

  const change = (next: boolean) => {
    setOn(next);
    const root = document.documentElement;
    if (next && !document.fullscreenElement) {
      // Refused or unsupported: the view still fills the window.
      root.requestFullscreen?.().catch(() => {});
    } else if (!next && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    if (!on) return undefined;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    let entered = Boolean(document.fullscreenElement);
    const onFullscreen = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) setOn(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement && !event.defaultPrevented) setOn(false);
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('keydown', onKey);
    const inert = inertAround(viewRef.current);
    return () => {
      for (const element of inert) element.inert = false;
      root.style.overflow = overflow;
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [on, viewRef]);

  return [on, change];
}

const TOASTS = 'section[aria-live], [data-sonner-toaster]';

/** Makes everything around `view` inert, up to the body, except the toasts; returns what it changed. */
function inertAround(view: HTMLElement | null): HTMLElement[] {
  const changed: HTMLElement[] = [];
  for (let node = view; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
      // Sonner's region (`section[aria-live]`) holds the toasts: a refused drag must still say why.
      if (sibling.matches(TOASTS) || sibling.querySelector(TOASTS)) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
  }
  return changed;
}
