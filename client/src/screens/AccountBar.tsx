import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { api } from '../lib/api';

export function AccountBar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const navigate = useNavigate();
  const signOut = useMutation({
    mutationFn: api.signOut,
    // Signing out always lands on login, even if the session was already gone.
    onSettled: () => navigate({ to: '/login' }),
  });

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-8">
      <Link to="/campaigns" className="font-display text-h2 no-underline">
        quest-fast<span className="text-accent-text">.</span>
      </Link>
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatarUrl ?? undefined} />
        <span className="hidden text-small text-text-secondary sm:inline">{name}</span>
        <Button variant="ghost" loading={signOut.isPending} onClick={() => signOut.mutate()}>
          Sair
        </Button>
      </div>
    </header>
  );
}
