import { DiscordLogo } from '@phosphor-icons/react';
import { AuthFailedAlert } from './AuthFailedAlert';
import { Avatar } from './Avatar';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { Surface } from './Surface';
import { Button as LinkButton } from './ui/button';
import { Skeleton } from './ui/skeleton';

type InviteSummary = { campaignName: string; master: { name: string; avatarUrl: string | null }; playerCount: number };

type InvitePanelProps = {
  state: 'loading' | 'anonymous' | 'guest' | 'blocked' | 'invalid' | 'error';
  invite?: InviteSummary;
  loginHref: string;
  campaignsHref: string;
  failed?: boolean;
  onJoin?: () => void;
  joining?: boolean;
  joinError?: string;
  onLoginClick?: () => void;
  onRetry?: () => void;
};

function playerCountText(count: number) {
  if (count === 0) return 'Nenhum jogador na mesa ainda';
  return count === 1 ? '1 jogador na mesa' : `${count} jogadores na mesa`;
}

function InviteSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Carregando convite" className="grid gap-3">
    <Skeleton className="w-1/3" />
    <Skeleton className="h-8 w-4/5" />
    <div className="flex items-center gap-3"><Skeleton className="size-10 shrink-0 rounded-full" /><Skeleton className="w-3/5" /></div>
  </div>;
}

function InviteCard({ invite }: { invite: InviteSummary }) {
  return <div className="grid min-w-0 gap-4">
    <p className="text-small font-semibold tracking-wide text-accent-text uppercase">Convite para a mesa</p>
    <h1 className="font-display text-display font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">{invite.campaignName}</h1>
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={invite.master.name} src={invite.master.avatarUrl ?? undefined} />
      <p className="min-w-0 text-text-secondary [overflow-wrap:anywhere]"><strong className="font-semibold text-foreground">{invite.master.name}</strong> está reunindo o grupo</p>
    </div>
    <p className="text-small text-text-muted">{playerCountText(invite.playerCount)}</p>
  </div>;
}

const NOTICES = {
  blocked: 'Você não pode entrar nesta mesa. Fale com quem te chamou.',
  invalid: 'Este convite não vale mais. Peça um link novo para quem te chamou.',
  error: 'Não foi possível carregar o convite.',
} as const;

function InviteNotice({ state, onRetry }: { state: keyof typeof NOTICES; onRetry?: () => void }) {
  return <div className="grid gap-3">
    <h1 className="font-display text-display font-semibold tracking-tight">Convite para a mesa</h1>
    <p role={state === 'error' ? 'alert' : undefined} className="text-pretty">{NOTICES[state]}</p>
    {state === 'error' && <Button variant="secondary" onClick={onRetry}>Tentar de novo</Button>}
  </div>;
}

function InviteActions({ state, loginHref, campaignsHref, failed, onJoin, joining, joinError, onLoginClick }:
  Pick<InvitePanelProps, 'state' | 'loginHref' | 'campaignsHref' | 'failed' | 'onJoin' | 'joining' | 'joinError' | 'onLoginClick'>) {
  if (state === 'anonymous') {
    return <>
      {failed && <AuthFailedAlert />}
      <div className="grid gap-3">
        <LinkButton asChild size="lg" className="w-full whitespace-normal text-center">
          <a href={loginHref} onClick={onLoginClick}><DiscordLogo size={18} aria-hidden="true" />Entrar com Discord para jogar</a>
        </LinkButton>
        <p className="text-small text-text-muted">É rápido e gratuito: usamos só seu nome e avatar do Discord.</p>
      </div>
    </>;
  }
  if (state === 'guest') {
    return <div className="grid gap-3">
      <Button className="w-full" onClick={onJoin} loading={joining}>Entrar na mesa</Button>
      {joinError && <p role="alert" className="text-small text-danger-text">{joinError}</p>}
    </div>;
  }
  if (state === 'blocked' || state === 'invalid') {
    return <LinkButton asChild variant="secondary" size="lg" className="w-full">
      <a href={campaignsHref}>Minhas campanhas</a>
    </LinkButton>;
  }
  return null;
}

export function InvitePanel({ state, invite, onRetry, ...actions }: InvitePanelProps) {
  const showCard = invite && (state === 'anonymous' || state === 'guest');
  return (
    <main className="flex min-h-dvh flex-col justify-end bg-background p-4 text-foreground min-[600px]:items-center min-[600px]:justify-center min-[600px]:p-8">
      <Surface variant="sheet" className="grid w-full min-w-0 gap-6 min-[600px]:max-w-md min-[600px]:p-8">
        <div className="flex items-center gap-2">
          <BrandMark />
          <p className="font-display text-body font-semibold tracking-tight">quest-fast</p>
        </div>

        {state === 'loading' && <><h1 className="sr-only">Convite para a mesa</h1><InviteSkeleton /></>}
        {showCard && <InviteCard invite={invite} />}
        {state in NOTICES && <InviteNotice state={state as keyof typeof NOTICES} onRetry={onRetry} />}
        <InviteActions state={state} {...actions} />
      </Surface>
    </main>
  );
}
