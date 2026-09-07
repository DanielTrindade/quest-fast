import { useSyncExternalStore, type ReactNode } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';

function subscribe(onChange: () => void) {
  const query = window.matchMedia('(prefers-color-scheme: light)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function ThemePreview({ mode, children }: { mode: string; children: ReactNode }) {
  const systemIsLight = useSyncExternalStore(subscribe,
    () => window.matchMedia('(prefers-color-scheme: light)').matches,
    () => false);
  const themes = mode === 'both' ? ['dark', 'light'] : [
    mode === 'system' ? (systemIsLight ? 'light' : 'dark') : mode === 'light' ? 'light' : 'dark',
  ];

  return (
    <main className="theme-grid" data-comparison={themes.length === 2}>
      {themes.map((theme) => (
        <section key={theme} className="theme-frame" data-theme={theme}
          aria-label={`Tema ${theme === 'dark' ? 'escuro' : 'claro'}`}>
          <div className="theme-frame__header">
            {theme === 'dark' ? <Moon size={16} weight="regular" aria-hidden="true" />
              : <Sun size={16} weight="regular" aria-hidden="true" />}
            <span>{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
            <span className="theme-frame__hint">{mode === 'system' ? 'Preferência do sistema' : 'quest-fast'}</span>
          </div>
          <div className="theme-frame__panel">{children}</div>
        </section>
      ))}
    </main>
  );
}
