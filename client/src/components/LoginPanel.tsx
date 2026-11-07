import type { MouseEvent } from 'react';
import { DiceFive, DiscordLogo, LockSimple, Notebook, Sword, WarningCircle } from '@phosphor-icons/react';
import { Surface } from './Surface';

const FEATURES = [
  { icon: Notebook, title: 'Ficha oficial de D&D 2024', detail: 'PV, dados de vida e moedas atualizados durante a sessão.' },
  { icon: DiceFive, title: 'Dados rolados no servidor', detail: 'A mesa vê cada rolagem na hora.' },
  { icon: Sword, title: 'Combate por turnos', detail: 'Iniciativa e bestiário do mestre.' },
];

type LoginPanelProps = {
  href: string;
  failed?: boolean;
  leaving?: boolean;
  onLeave?: () => void;
};

export function LoginPanel({ href, failed = false, leaving = false, onLeave }: LoginPanelProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (leaving) {
      event.preventDefault();
      return;
    }
    onLeave?.();
  }

  return (
    <main className="qf-login">
      <Surface variant="sheet" className="qf-login__panel">
        <div>
          <div className="qf-login__brand">
            <span className="qf-brand-mark" aria-hidden="true" />
            <h1>quest-fast</h1>
          </div>
          <p className="qf-login__lede">Sua mesa de D&amp;D 5e. O Discord fica com a voz.</p>
        </div>

        <ul className="qf-login__features">
          {FEATURES.map(({ icon: Icon, title, detail }) => (
            <li key={title}>
              <span className="qf-login__feature-icon"><Icon size={18} aria-hidden="true" /></span>
              <div><strong>{title}</strong><span>{detail}</span></div>
            </li>
          ))}
        </ul>

        {failed && (
          <div role="alert" className="qf-login__alert">
            <WarningCircle size={20} aria-hidden="true" />
            <div>
              <strong>O Discord não confirmou sua entrada.</strong>
              <span>Se você cancelou a autorização, é só tentar de novo.</span>
            </div>
          </div>
        )}

        <a
          href={href}
          onClick={handleClick}
          aria-busy={leaving || undefined}
          aria-disabled={leaving || undefined}
          className="qf-button qf-button--primary qf-login__action"
        >
          {leaving
            ? <><span className="qf-button__loading" aria-hidden="true" />Abrindo o Discord…</>
            : <><DiscordLogo size={18} aria-hidden="true" />Entrar com o Discord</>}
        </a>

        <p className="qf-login__privacy">
          <LockSimple size={16} aria-hidden="true" />
          <span>Usamos só seu nome e avatar do Discord. Não lemos servidores nem mensagens.</span>
        </p>
      </Surface>
    </main>
  );
}
