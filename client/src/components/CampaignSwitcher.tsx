import { useContext } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { CaretUpDown, Check, SquaresFour } from '@phosphor-icons/react';
import type { Role } from '@quest-fast/shared';
import { PortalContext } from '../lib/portal-context';

export type CampaignOption = { id: string; name: string; role?: Role };

const ROLE_LABEL: Record<Role, string> = { master: 'Mestre', player: 'Jogador' };

// Short connectives ("de", "da", "e") make poor initials.
function initials(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const meaningful = words.filter(word => word.length > 2 || /^\p{Lu}/u.test(word));
  const letters = (meaningful.length ? meaningful : words).map(word => [...word][0]);
  return (letters.length > 1 ? [letters[0], letters.at(-1)] : letters).join('').toLocaleUpperCase('pt-BR') || '?';
}

export function CampaignMark({ name, current = false }: { name: string; current?: boolean }) {
  return <span className={`qf-campaign-mark${current ? ' qf-campaign-mark--current' : ''}`} aria-hidden="true">
    {initials(name)}
  </span>;
}

export function CampaignSwitcher({ campaigns, campaignId, onCampaignChange, onShowAll, compact = false }: {
  campaigns: CampaignOption[]; campaignId: string; onCampaignChange: (id: string) => void;
  onShowAll?: () => void; compact?: boolean;
}) {
  const container = useContext(PortalContext);
  const current = campaigns.find(campaign => campaign.id === campaignId);
  if (!current) {
    return <button type="button" className="qf-switcher" disabled data-compact={compact || undefined}>
      <span className="qf-switcher__text"><span className="qf-switcher__name">Nenhuma campanha</span></span>
    </button>;
  }
  return <Menu.Root modal={false}>
    <Menu.Trigger className="qf-switcher" data-compact={compact || undefined}>
      <CampaignMark name={current.name} current />
      <span className="qf-switcher__text">
        <span className="sr-only">Campanha: </span>
        <span className="qf-switcher__name">{current.name}</span>
        {current.role && <span className="qf-switcher__role">{ROLE_LABEL[current.role]}</span>}
      </span>
      <CaretUpDown size={16} aria-hidden="true" className="qf-switcher__caret" />
    </Menu.Trigger>
    <Menu.Portal container={container}>
      <Menu.Content className="qf-menu" align="start" side={compact ? 'right' : 'bottom'} sideOffset={6} collisionPadding={8}>
        <Menu.Label className="qf-menu__label">Trocar campanha</Menu.Label>
        <Menu.RadioGroup value={campaignId} onValueChange={onCampaignChange}>
          {campaigns.map(campaign => <Menu.RadioItem key={campaign.id} value={campaign.id} className="qf-menu__item">
            <CampaignMark name={campaign.name} current={campaign.id === campaignId} />
            <span className="qf-menu__text">
              <span>{campaign.name}</span>
              {campaign.role && <span className="qf-menu__hint">{ROLE_LABEL[campaign.role]}</span>}
            </span>
            <Menu.ItemIndicator className="qf-menu__check"><Check size={16} aria-hidden="true" /></Menu.ItemIndicator>
          </Menu.RadioItem>)}
        </Menu.RadioGroup>
        {onShowAll && <>
          <Menu.Separator className="qf-menu__separator" />
          <Menu.Item className="qf-menu__item" onSelect={onShowAll}>
            <SquaresFour size={20} aria-hidden="true" />Ver todas as campanhas
          </Menu.Item>
        </>}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
