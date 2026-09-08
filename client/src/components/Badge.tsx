import { Crown, User } from '@phosphor-icons/react';

export function Badge({ role }: { role: 'master' | 'player' }) {
  const Icon = role === 'master' ? Crown : User;
  return <span className={`qf-badge qf-badge--${role}`}>
    <Icon size={14} weight="regular" aria-hidden="true" />{role === 'master' ? 'Mestre' : 'Jogador'}
  </span>;
}
