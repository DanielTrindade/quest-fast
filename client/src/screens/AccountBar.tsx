import { Link } from '@tanstack/react-router';
import { AccountMenu } from '../components/AccountMenu';
import { useSignOut } from '../hooks/useSignOut';

export function AccountBar(props: { name: string; avatarUrl: string | null }) {
  const signOut = useSignOut();
  return <header className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-secret px-4 py-2 sm:px-8">
    <Link to="/campaigns" className="font-display text-h2 no-underline">
      quest-fast<span className="text-accent-text">.</span>
    </Link>
    <div>
      <AccountMenu {...props} compact side="bottom" onSignOut={() => signOut.mutate()} signingOut={signOut.isPending} />
    </div>
  </header>;
}
