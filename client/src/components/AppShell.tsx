import { useEffect, useEffectEvent, useId, type ReactNode } from 'react';
import { SidebarSimple } from '@phosphor-icons/react';
import { AccountMenu, type Account } from './AccountMenu';
import { CampaignSwitcher, type CampaignOption } from './CampaignSwitcher';
import { CampaignNav, type NavItem } from './CampaignNav';
import { Tooltip, TooltipProvider } from './Tooltip';
import { cn } from '../lib/utils';

export type { CampaignOption } from './CampaignSwitcher';
export type { NavItem } from './CampaignNav';

export function AppShell({
  campaigns, campaignId, onCampaignChange, onShowAllCampaigns, navigation, activeItem, onNavigate, account,
  collapsed, onCollapsedChange, children,
}: {
  campaigns: CampaignOption[]; campaignId: string; onCampaignChange: (id: string) => void;
  onShowAllCampaigns?: () => void; navigation: NavItem[]; activeItem: string;
  onNavigate?: (href: string) => void; account: Account;
  collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void; children: ReactNode;
}) {
  const id = useId();
  const toggle = useEffectEvent(() => onCollapsedChange(!collapsed));
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggle();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const switcher = { campaigns, campaignId, onCampaignChange, onShowAll: onShowAllCampaigns };
  const collapseLabel = collapsed ? 'Expandir menu' : 'Recolher menu';
  const collapseButton = <button type="button" onClick={() => onCollapsedChange(!collapsed)}
    aria-expanded={!collapsed} aria-controls={`${id}-sidebar`} aria-keyshortcuts="Control+B"
    className={cn('flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control bg-transparent px-3 whitespace-nowrap text-text-secondary transition-[background-color,color] duration-(--duration-quick) ease-settle hover:bg-card hover:text-foreground',
      collapsed && 'justify-center px-0')}>
    <SidebarSimple size={20} aria-hidden="true" className={cn('motion-safe:transition-transform motion-safe:duration-(--duration-settle) motion-safe:ease-settle', collapsed && '-scale-x-100')} />
    <span className={cn(collapsed && 'sr-only')}>{collapseLabel}</span>
    {!collapsed && <kbd aria-hidden="true" className="ml-auto rounded-control border border-border-strong px-1 font-mono text-micro text-text-muted">Ctrl B</kbd>}
  </button>;

  return <TooltipProvider delayDuration={200}>
    <div data-slot="shell" className="@container relative min-w-0 bg-background text-foreground">
      <a href={`#${id}-content`} className="absolute top-2 left-2 z-30 -translate-y-[200%] bg-popover p-3 text-accent-text not-focus:[clip-path:inset(100%)] focus:translate-y-0">Ir para o conteúdo</a>
      <div data-collapsed={collapsed || undefined} className="grid grid-cols-[minmax(0,1fr)] [grid-template-areas:'top'_'content'_'tabbar'] motion-safe:transition-[grid-template-columns] motion-safe:duration-(--duration-settle) motion-safe:ease-settle @min-[760px]:min-h-dvh @min-[760px]:grid-cols-[248px_minmax(0,1fr)] @min-[760px]:[grid-template-areas:'sidebar_content'] @min-[760px]:data-collapsed:grid-cols-[64px_minmax(0,1fr)]">
        <aside id={`${id}-sidebar`} aria-label="Menu da campanha" className="sticky top-0 hidden h-dvh flex-col gap-1 self-start overflow-x-hidden overflow-y-auto border-r border-border bg-surface-secret px-2 py-3 [grid-area:sidebar] @min-[760px]:flex">
          <Tooltip label="Trocar campanha" disabled={!collapsed}>
            <span className="block"><CampaignSwitcher {...switcher} compact={collapsed} /></span>
          </Tooltip>
          <CampaignNav items={navigation} activeItem={activeItem} onNavigate={onNavigate} ariaLabel="Navegação da campanha" collapsed={collapsed} />
          <div className="mt-auto grid gap-1 border-t border-border pt-2">
            <AccountMenu {...account} compact={collapsed} side={collapsed ? 'right' : 'top'} />
            <Tooltip label={<>{collapseLabel} <kbd>Ctrl B</kbd></>} disabled={!collapsed}>{collapseButton}</Tooltip>
          </div>
        </aside>
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface-secret px-2 py-1 [grid-area:top] @min-[760px]:hidden">
          <CampaignSwitcher {...switcher} className="flex-1" />
          <AccountMenu {...account} compact side="bottom" className="w-auto" />
        </header>
        <div id={`${id}-content`} tabIndex={-1} className="min-w-0 px-4 py-6 [overflow-wrap:anywhere] [grid-area:content] [&_[id]]:scroll-mt-20 @min-[760px]:p-8 @min-[760px]:[&_[id]]:scroll-mt-6">{children}</div>
        <CampaignNav items={navigation} activeItem={activeItem} onNavigate={onNavigate} ariaLabel="Navegação da campanha"
          variant="bar" className="sticky bottom-0 z-20 border-t border-border bg-surface-secret px-1 pt-1 pb-[calc(var(--spacing-1)+env(safe-area-inset-bottom,0px))] [grid-area:tabbar] @min-[760px]:hidden" />
      </div>
    </div>
  </TooltipProvider>;
}
