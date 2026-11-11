import { useId } from 'react';
import type { CampaignBan } from '@quest-fast/shared';
import { Avatar } from './Avatar';
import { Button } from './Button';

type BannedListProps = {
  bans: CampaignBan[];
  onUnban: (userId: string) => void;
  unbanning?: string;
};

export function BannedList({ bans, onUnban, unbanning }: BannedListProps) {
  const titleId = useId();
  if (bans.length === 0) return null;
  return <section aria-labelledby={titleId} className="grid min-w-0 gap-3">
    <div className="grid gap-1">
      <h3 id={titleId} className="font-display text-h2 font-semibold">Removidos</h3>
      <p className="text-small text-text-muted">Quem você removeu não entra por convite até ser liberado.</p>
    </div>
    <ul>
      {bans.map(ban => <li key={ban.userId} className="flex items-center gap-3 border-border py-3 not-first:border-t">
        <Avatar name={ban.name} src={ban.avatarUrl ?? undefined} />
        <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{ban.name}</span>
        <Button variant="ghost" aria-label={`Liberar entrada de ${ban.name}`} loading={unbanning === ban.userId} onClick={() => onUnban(ban.userId)}>Liberar entrada</Button>
      </li>)}
    </ul>
  </section>;
}
