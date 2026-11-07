import { useState } from 'react';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** A per-browser preference; storage may be blocked, so it degrades to memory. */
export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(key));
  function update(next: boolean) {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Blocked storage only loses the preference on reload.
    }
  }
  return [value, update];
}
