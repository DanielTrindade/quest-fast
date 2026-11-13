import { useState } from 'react';

/**
 * The portrait to show, or null once it failed to load (an expired Discord
 * image, a removed upload): the caller then draws the token instead of a
 * broken image. A new URL gets a fresh try.
 */
export function usePortrait(url: string | null) {
  const [failed, setFailed] = useState<string | null>(null);
  return {
    src: url && url !== failed ? url : null,
    onError: () => setFailed(url),
  };
}
