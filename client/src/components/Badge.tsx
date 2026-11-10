import { Crown, User } from '@phosphor-icons/react';
import { Badge as UIBadge } from './ui/badge';

export function Badge({ role }: { role: 'master' | 'player' }) {
  const Icon = role === 'master' ? Crown : User;
  return <UIBadge variant={role === 'master' ? 'accent' : 'secondary'}>
    <Icon weight="regular" aria-hidden="true" />{role === 'master' ? 'Mestre' : 'Jogador'}
  </UIBadge>;
}
