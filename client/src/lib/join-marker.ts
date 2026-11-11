const KEY = 'qf_join_after_login';

export function setJoinMarker(code: string) {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // Storage can be blocked: without the marker the visitor just confirms by hand.
  }
}

export function readJoinMarker(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearJoinMarker() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
