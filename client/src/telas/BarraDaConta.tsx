import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { api } from '../lib/api';

export function BarraDaConta({ nome, avatarUrl }: { nome: string; avatarUrl: string | null }) {
  const navegar = useNavigate();
  const sair = useMutation({
    mutationFn: api.sair,
    // Sair sempre leva à tela de login, mesmo que a sessão já tivesse morrido.
    onSettled: () => navegar({ to: '/entrar' }),
  });

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-8">
      <Link to="/campanhas" className="font-display text-h2 no-underline">
        quest-fast<span className="text-accent-text">.</span>
      </Link>
      <div className="flex items-center gap-3">
        <Avatar name={nome} src={avatarUrl ?? undefined} />
        <span className="hidden text-small text-text-secondary sm:inline">{nome}</span>
        <Button variant="ghost" loading={sair.isPending} onClick={() => sair.mutate()}>
          Sair
        </Button>
      </div>
    </header>
  );
}
