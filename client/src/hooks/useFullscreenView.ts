import { useEffect, useState } from 'react';

/**
 * A view that fills the window and, where the browser allows it (not on an
 * iPhone, say), the whole screen. Leaving the browser's full screen (Esc, a
 * gesture) leaves the view too; with only the window filled, Esc leaves it.
 * The page behind does not scroll meanwhile.
 */
export function useFullscreenView(): [boolean, (on: boolean) => void] {
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
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [on]);

  return [on, change];
}
