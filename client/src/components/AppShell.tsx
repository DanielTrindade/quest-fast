import { useId, type ReactNode } from 'react';
import { List } from '@phosphor-icons/react';

export type CampaignOption = { id: string; name: string };
export type NavItem = { id: string; label: string; href: string };

export function AppShell({ campaigns, campaignId, onCampaignChange, navigation, activeItem, user, children }: {
  campaigns: CampaignOption[]; campaignId: string; onCampaignChange: (id: string) => void;
  navigation: NavItem[]; activeItem: string; user: ReactNode; children: ReactNode;
}) {
  const id = useId();
  const links = navigation.map(item => <a key={item.id} href={item.href}
    aria-current={activeItem === item.id ? 'page' : undefined}>{item.label}</a>);
  return <div className="qf-shell">
    <a className="qf-skip-link" href={`#${id}-content`}>Ir para o conteúdo</a>
    <header className="qf-shell__header">
      <span className="qf-shell__wordmark">quest-fast<span aria-hidden="true">.</span></span>
      <div className="qf-shell__campaign">
        <label htmlFor={`${id}-campaign`}>Campanha</label>
        <select id={`${id}-campaign`} value={campaignId} onChange={e => onCampaignChange(e.target.value)}
          disabled={campaigns.length === 0}>
          {campaigns.length === 0 && <option value="">Nenhuma campanha</option>}
          {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
      </div>
      <div className="qf-shell__user">{user}</div>
    </header>
    <div className="qf-shell__body">
      <nav className="qf-shell__desktop-nav" aria-label="Navegação da campanha">{links}</nav>
      <details className="qf-shell__mobile-nav">
        <summary><List size={20} aria-hidden="true" /> Navegação da campanha</summary>
        <nav aria-label="Navegação da campanha">{links}</nav>
      </details>
      <div id={`${id}-content`} tabIndex={-1} className="qf-shell__content">{children}</div>
    </div>
  </div>;
}
