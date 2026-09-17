import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { api } from '../lib/api';

export function AccountControls({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: api.signOut,
    // Signing out always lands on login, even if the session was already gone.
    onSettled: () => {
      // No cache belongs to the next session: drop the previous user's data
      // before the redirect so the login screen cannot read it back.
      queryClient.clear();
      navigate({ to: '/login' });
    },
  });

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={avatarUrl ?? undefined} />
      <span className="hidden text-small text-text-secondary sm:inline">{name}</span>
      <Button variant="ghost" loading={signOut.isPending} onClick={() => signOut.mutate()}>
        Sair
      </Button>
    </div>
  );
}

export function AccountBar(props: { name: string; avatarUrl: string | null }) {
  return <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-8">
    <Link to="/campaigns" className="font-display text-h2 no-underline">
      quest-fast<span className="text-accent-text">.</span>
    </Link>
    <AccountControls {...props} />
  </header>;
}
