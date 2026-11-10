import { CaretUpDown, SquaresFour } from '@phosphor-icons/react';
import type { Role } from '@quest-fast/shared';
import { initials } from '../lib/initials';
import { cn } from '../lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { trigger } from './shell-styles';

export type CampaignOption = { id: string; name: string; role?: Role };

const ROLE_LABEL: Record<Role, string> = { master: 'Mestre', player: 'Jogador' };

// Short connectives ("de", "da", "e") make poor initials.
const connective = (word: string) => word.length <= 2 && !/^\p{Lu}/u.test(word);

export function CampaignMark({ name, current = false }: { name: string; current?: boolean }) {
  return <span aria-hidden="true" className={cn(
    'inline-grid size-8 shrink-0 place-items-center rounded-control border font-display text-small leading-none font-bold',
    current ? 'border-primary bg-primary text-primary-foreground edge-action' : 'border-border-strong bg-popover text-foreground edge-raised')}>
    {initials(name, connective)}
  </span>;
}

const text = 'grid min-w-0 flex-1 group-data-compact/trigger:sr-only';
const nameClass = 'truncate font-display font-semibold';

export function CampaignSwitcher({ campaigns, campaignId, onCampaignChange, onShowAll, compact = false, className }: {
  campaigns: CampaignOption[]; campaignId: string; onCampaignChange: (id: string) => void;
  onShowAll?: () => void; compact?: boolean; className?: string;
}) {
  const current = campaigns.find(campaign => campaign.id === campaignId);
  if (!current) {
    return <button type="button" className={cn(trigger, className)} disabled data-compact={compact || undefined}>
      <span className={text}><span className={nameClass}>Nenhuma campanha</span></span>
    </button>;
  }
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger className={cn(trigger, className)} data-compact={compact || undefined}>
      <CampaignMark name={current.name} current />
      <span className={text}>
        <span className="sr-only">Campanha: </span>
        <span className={nameClass}>{current.name}</span>
        {current.role && <span className="text-micro text-text-muted">{ROLE_LABEL[current.role]}</span>}
      </span>
      <CaretUpDown size={16} aria-hidden="true" className="shrink-0 text-text-muted group-data-compact/trigger:hidden" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" side={compact ? 'right' : 'bottom'} collisionPadding={8}>
      <DropdownMenuLabel>Trocar campanha</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={campaignId} onValueChange={onCampaignChange}>
        {campaigns.map(campaign => <DropdownMenuRadioItem key={campaign.id} value={campaign.id}>
          <CampaignMark name={campaign.name} current={campaign.id === campaignId} />
          <span className="grid min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span>{campaign.name}</span>
            {campaign.role && <span className="text-micro text-text-muted">{ROLE_LABEL[campaign.role]}</span>}
          </span>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
      {onShowAll && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onShowAll}>
          <SquaresFour size={20} aria-hidden="true" />Ver todas as campanhas
        </DropdownMenuItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
