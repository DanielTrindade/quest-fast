import { CaretUpDown, SignOut } from '@phosphor-icons/react';
import { Avatar } from './Avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import { trigger } from './shell-styles';

export type Account = { name: string; avatarUrl: string | null; onSignOut: () => void; signingOut?: boolean };

export function AccountMenu({ name, avatarUrl, onSignOut, signingOut = false, compact = false, side = 'top', className }: Account & {
  compact?: boolean; side?: 'top' | 'bottom' | 'right'; className?: string;
}) {
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger className={cn(trigger, 'p-1', className)} data-compact={compact || undefined} aria-label={`Conta de ${name}`}>
      <Avatar name={name} src={avatarUrl ?? undefined} />
      <span className="min-w-0 flex-1 truncate text-small group-data-compact/trigger:hidden" aria-hidden="true">{name}</span>
      <CaretUpDown size={16} aria-hidden="true" className="shrink-0 text-text-muted group-data-compact/trigger:hidden" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side={side} align={side === 'bottom' ? 'end' : 'start'} collisionPadding={8}>
      <DropdownMenuLabel className="[overflow-wrap:anywhere]">{name}</DropdownMenuLabel>
      <DropdownMenuItem disabled={signingOut} onSelect={onSignOut}>
        <SignOut size={20} aria-hidden="true" />{signingOut ? 'Saindo…' : 'Sair'}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
