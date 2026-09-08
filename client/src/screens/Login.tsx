import { DiscordLogo } from '@phosphor-icons/react';
import { Surface } from '../components/Surface';
import { LOGIN_PATH } from '../lib/api';

/**
 * Login leaves the SPA through a real navigation: the server is what answers
 * Discord. That is why this is a link, not a fetch.
 *
 * Visible copy stays in Portuguese — it is what the table reads.
 */
export function Login({ failed }: { failed: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-4 text-text-primary sm:p-8">
      <Surface className="w-full max-w-md p-6">
        <p className="mb-1 font-mono text-micro uppercase tracking-wider text-text-muted">
          Sua mesa de D&amp;D 5e
        </p>
        <h1 className="font-display text-h1">quest-fast</h1>
        <p className="mt-2 text-body text-text-secondary">
          Ficha, dados, combate e mundo no mesmo lugar. O Discord fica com a voz.
        </p>

        {failed && (
          <p role="alert" className="mt-4 text-small text-danger-text">
            Não foi possível entrar com o Discord. Tente novamente.
          </p>
        )}

        <a
          href={LOGIN_PATH}
          className="qf-button qf-button--primary mt-6 inline-flex w-full justify-center no-underline"
        >
          <DiscordLogo size={18} aria-hidden="true" />
          Entrar com o Discord
        </a>

        <p className="mt-4 text-small text-text-muted">
          Usamos apenas seu nome e avatar do Discord.
        </p>
      </Surface>
    </main>
  );
}
