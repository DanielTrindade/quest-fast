import type { MouseEvent } from 'react';
import { DiceFive, DiscordLogo, LockSimple, Notebook, Sword, WarningCircle } from '@phosphor-icons/react';
import { Surface } from './Surface';
import { Button } from './ui/button';

const FEATURES = [
  { icon: Notebook, title: 'Ficha oficial de D&D 2024', detail: 'PV, dados de vida e moedas atualizados durante a sessão.' },
  { icon: DiceFive, title: 'Dados rolados no servidor', detail: 'A mesa vê cada rolagem na hora.' },
  { icon: Sword, title: 'Combate por turnos', detail: 'Iniciativa e bestiário do mestre.' },
];

// The brand is the system's diamond (death saves, loading) set in the action tone.
function BrandMark() {
  return <span aria-hidden="true" className="relative inline-block size-7 shrink-0 before:absolute before:inset-1 before:rotate-45 before:rounded-[3px] before:bg-primary before:shadow-[inset_0_1px_0_var(--color-action-light)] after:absolute after:inset-2.5 after:rotate-45 after:rounded-[1px] after:border-[1.5px] after:border-primary-foreground after:opacity-85" />;
}

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
    // A modified or non-primary activation opens Discord elsewhere; this page stays usable.
    const opensElsewhere = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (!opensElsewhere) onLeave?.();
  }

  return (
    <main className="flex min-h-dvh flex-col justify-end bg-background p-4 text-foreground min-[600px]:items-center min-[600px]:justify-center min-[600px]:p-8">
      <Surface variant="sheet" className="grid w-full min-w-0 gap-6 min-[600px]:max-w-md min-[600px]:p-8">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark />
            <h1 className="font-display text-display font-semibold tracking-tight">quest-fast</h1>
          </div>
          <p className="mt-2 text-pretty text-text-secondary">Sua mesa de D&amp;D 5e. O Discord fica com a voz.</p>
        </div>

        <ul className="m-0 grid list-none gap-3 p-0">
          {FEATURES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3">
              <span className="grid size-8 place-items-center rounded-control border border-border-strong bg-background text-text-secondary edge-inset"><Icon size={18} aria-hidden="true" /></span>
              <div><strong className="block font-semibold">{title}</strong><span className="block text-small text-text-secondary">{detail}</span></div>
            </li>
          ))}
        </ul>

        {failed && (
          <div role="alert" className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-panel border border-s-4 border-danger bg-(--color-danger-surface) p-3">
            <WarningCircle size={20} aria-hidden="true" className="mt-0.5 text-danger-text" />
            <div>
              <strong className="block font-semibold">O Discord não confirmou sua entrada.</strong>
              <span className="mt-1 block text-small text-text-secondary">Se você cancelou a autorização, é só tentar de novo.</span>
            </div>
          </div>
        )}

        <Button asChild size="lg" className="w-full aria-busy:cursor-progress">
          <a href={href} onClick={handleClick} aria-busy={leaving || undefined} aria-disabled={leaving || undefined}>
            {leaving
              ? <><span className="size-2.5 shrink-0 rotate-45 rounded-[2px] bg-current opacity-60 motion-safe:animate-pulse" aria-hidden="true" />Abrindo o Discord…</>
              : <><DiscordLogo size={18} aria-hidden="true" />Entrar com o Discord</>}
          </a>
        </Button>

        <p className="flex items-start gap-2 border-t border-border pt-4 text-small text-text-muted">
          <LockSimple size={16} aria-hidden="true" className="mt-px shrink-0" />
          <span>Usamos só seu nome e avatar do Discord. Não lemos servidores nem mensagens.</span>
        </p>
      </Surface>
    </main>
  );
}
