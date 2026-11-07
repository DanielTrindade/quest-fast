import { useContext } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { CaretUpDown, SignOut } from '@phosphor-icons/react';
import { PortalContext } from '../lib/portal-context';
import { Avatar } from './Avatar';

export type Account = { name: string; avatarUrl: string | null; onSignOut: () => void; signingOut?: boolean };

export function AccountMenu({ name, avatarUrl, onSignOut, signingOut = false, compact = false, side = 'top' }: Account & {
  compact?: boolean; side?: 'top' | 'bottom' | 'right';
}) {
  const container = useContext(PortalContext);
  return <Menu.Root modal={false}>
    <Menu.Trigger className="qf-account" data-compact={compact || undefined} aria-label={`Conta de ${name}`}>
      <Avatar name={name} src={avatarUrl ?? undefined} />
      <span className="qf-account__name" aria-hidden="true">{name}</span>
      <CaretUpDown size={16} aria-hidden="true" className="qf-account__caret" />
    </Menu.Trigger>
    <Menu.Portal container={container}>
      <Menu.Content className="qf-menu" side={side} align={side === 'bottom' ? 'end' : 'start'} sideOffset={6} collisionPadding={8}>
        <Menu.Label className="qf-menu__label">{name}</Menu.Label>
        <Menu.Item className="qf-menu__item" disabled={signingOut} onSelect={onSignOut}>
          <SignOut size={20} aria-hidden="true" />{signingOut ? 'Saindo…' : 'Sair'}
        </Menu.Item>
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
