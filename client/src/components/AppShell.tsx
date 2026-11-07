import { useEffect, useEffectEvent, useId, type ReactNode } from 'react';
import { SidebarSimple } from '@phosphor-icons/react';
import { AccountMenu, type Account } from './AccountMenu';
import { CampaignSwitcher, type CampaignOption } from './CampaignSwitcher';
import { SectionNav, type NavItem } from './SectionNav';
import { Tooltip, TooltipProvider } from './Tooltip';

export type { CampaignOption } from './CampaignSwitcher';
export type { NavItem } from './SectionNav';

export function AppShell({
  campaigns, campaignId, onCampaignChange, onShowAllCampaigns, navigation, activeItem, account,
  collapsed, onCollapsedChange, children,
}: {
  campaigns: CampaignOption[]; campaignId: string; onCampaignChange: (id: string) => void;
  onShowAllCampaigns?: () => void; navigation: NavItem[]; activeItem: string; account: Account;
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
  const collapseButton = <button type="button" className="qf-shell__collapse" onClick={() => onCollapsedChange(!collapsed)}
    aria-expanded={!collapsed} aria-controls={`${id}-sidebar`} aria-keyshortcuts="Control+B">
    <SidebarSimple size={20} aria-hidden="true" />
    <span className="qf-shell__collapse-label">{collapseLabel}</span>
    <kbd aria-hidden="true">Ctrl B</kbd>
  </button>;

  return <TooltipProvider delayDuration={200}>
    <div className="qf-shell">
      <a className="qf-skip-link" href={`#${id}-content`}>Ir para o conteúdo</a>
      <div className="qf-shell__frame" data-collapsed={collapsed || undefined}>
        <aside id={`${id}-sidebar`} className="qf-shell__sidebar" aria-label="Menu da campanha">
          {collapsed
            ? <Tooltip label="Trocar campanha"><span className="qf-shell__slot"><CampaignSwitcher {...switcher} compact /></span></Tooltip>
            : <CampaignSwitcher {...switcher} />}
          <SectionNav items={navigation} activeItem={activeItem} ariaLabel="Navegação da campanha" collapsed={collapsed} />
          <div className="qf-shell__sidebar-footer">
            <AccountMenu {...account} compact={collapsed} side={collapsed ? 'right' : 'top'} />
            {collapsed ? <Tooltip label={<>{collapseLabel} <kbd>Ctrl B</kbd></>}>{collapseButton}</Tooltip> : collapseButton}
          </div>
        </aside>
        <header className="qf-shell__topbar">
          <CampaignSwitcher {...switcher} />
          <AccountMenu {...account} compact side="bottom" />
        </header>
        <div id={`${id}-content`} tabIndex={-1} className="qf-shell__content">{children}</div>
        <SectionNav items={navigation} activeItem={activeItem} ariaLabel="Navegação da campanha"
          variant="bar" className="qf-shell__tabbar" />
      </div>
    </div>
  </TooltipProvider>;
}
