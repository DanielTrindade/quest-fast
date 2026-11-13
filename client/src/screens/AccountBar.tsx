import { Link } from '@tanstack/react-router';
import { AccountMenu } from '../components/AccountMenu';
import { useSignOut } from '../hooks/useSignOut';

// The router marks the current screen with aria-current="page".
const accountLink = 'inline-flex min-h-11 items-center rounded-control px-2 text-small whitespace-nowrap text-text-secondary no-underline transition-colors duration-(--duration-quick) hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground';

export function AccountBar(props: { name: string; avatarUrl: string | null }) {
  const signOut = useSignOut();
  return <header className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-secret px-4 py-2 sm:px-8">
    <div className="flex min-w-0 items-center gap-6 max-[479px]:gap-3">
      <Link to="/campaigns" className="font-display text-h2 whitespace-nowrap no-underline max-[429px]:sr-only">
        quest-fast<span className="text-accent-text">.</span>
      </Link>
      <nav aria-label="Sua conta" className="flex items-center gap-1">
        <Link to="/campaigns" className={accountLink}>Campanhas</Link>
        <Link to="/characters" className={accountLink}>Meus personagens</Link>
      </nav>
    </div>
    <div>
      <AccountMenu {...props} compact side="bottom" onSignOut={() => signOut.mutate()} signingOut={signOut.isPending} />
    </div>
  </header>;
}
