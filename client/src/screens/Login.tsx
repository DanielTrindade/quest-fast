import { useEffect, useState } from 'react';
import { LoginPanel } from '../components/LoginPanel';
import { LOGIN_PATH } from '../lib/api';

/**
 * Login leaves the SPA through a real navigation: the server is what answers
 * Discord. That is why this is a link, not a fetch.
 */
export function Login({ failed }: { failed: boolean }) {
  const [leaving, setLeaving] = useState(false);

  // Coming back from Discord with the browser's Back button restores this page
  // from the back/forward cache, still showing "Abrindo o Discord…".
  useEffect(() => {
    function reset(event: PageTransitionEvent) {
      if (event.persisted) setLeaving(false);
    }
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return <LoginPanel href={LOGIN_PATH} failed={failed} leaving={leaving} onLeave={() => setLeaving(true)} />;
}
