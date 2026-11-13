import { Books, House, MapTrifold, Sword, UserCircle, UserPlus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { AppShell, type NavItem } from '../components/AppShell';
import { CampaignSocketChannel, CampaignSocketStatus, useCampaignSocket } from '../hooks/useCampaignSocket';
import { useStoredFlag } from '../hooks/useStoredFlag';
import { api } from '../lib/api';
import { encountersQuery } from '../lib/combat-cache';
import { useSignOut } from '../hooks/useSignOut';

function navigation(campaignId: string, isMaster: boolean, round: number | undefined): NavItem[] {
  const base = `/campaigns/${campaignId}`;
  const items: (NavItem | false)[] = [
    { id: 'overview', label: 'Visão geral', shortLabel: 'Início', href: base, icon: House, group: 'Mesa' },
    { id: 'table', label: 'Mesa', href: `${base}/table`, icon: MapTrifold, group: 'Mesa', badge: round ? `Rodada ${round}` : undefined },
    isMaster && { id: 'prep', label: 'Preparo', href: `${base}/prep`, icon: Sword, group: 'Mesa' },
    { id: 'players', label: 'Jogadores', href: `${base}/players`, icon: UserPlus, group: 'Administração' },
  ];
  return items.filter((item): item is NavItem => item !== false);
}

const ACCOUNT_LINKS: NavItem[] = [
  { id: 'campaigns', label: 'Campanhas', href: '/campaigns', icon: Books, group: 'Sua conta' },
  { id: 'characters', label: 'Meus personagens', href: '/characters', icon: UserCircle, group: 'Sua conta' },
];

/**
 * The campaign layout: the shell, the one socket of the campaign room and the
 * screen of the current route. The socket lives here so the round badge and
 * every cached fight stay live whichever screen is open.
 */
export function CampaignWorkspace({ campaignId, user }: {
  campaignId: string; user: { name: string; avatarUrl: string | null };
}) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const pathname = useLocation({ select: (location) => location.pathname.replace(/\/+$/, '') });
  const [collapsed, setCollapsed] = useStoredFlag('quest-fast:sidebar-collapsed');
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  const campaign = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.campaign(campaignId) });
  // No socket until the campaign answers: a 404 shows its error without a
  // connection retrying behind it.
  const { status: socketStatus, channel } = useCampaignSocket(campaignId, campaign.isSuccess);
  const encounters = useQuery(encountersQuery(campaignId));
  const activeFight = encounters.data?.encounters.find((fight) => fight.status === 'active');
  const items = navigation(campaignId, campaign.data?.role === 'master', activeFight?.round);
  const activeItem = items.find((item) => item.href === pathname)?.id ?? '';

  const options = campaigns.data?.campaigns ?? [];
  // A direct link can resolve before the list. Keep the selected campaign
  // represented without substituting a different campaign in the control.
  const available = options.some(option => option.id === campaignId)
    ? options
    : [{ id: campaignId, name: campaign.data?.name ?? 'Campanha atual', role: campaign.data?.role }, ...options];

  return <AppShell campaigns={available} campaignId={campaignId}
    onCampaignChange={id => { void navigate({ to: '/campaigns/$campaignId', params: { campaignId: id } }); }}
    onShowAllCampaigns={() => { void navigate({ to: '/campaigns' }); }}
    navigation={items} activeItem={activeItem} onNavigate={href => { void navigate({ href }); }}
    accountLinks={ACCOUNT_LINKS}
    account={{ ...user, onSignOut: () => signOut.mutate(), signingOut: signOut.isPending, onShowCharacters: () => { void navigate({ to: '/characters' }); } }}
    collapsed={collapsed} onCollapsedChange={setCollapsed}>
    <CampaignSocketStatus value={socketStatus}>
      <CampaignSocketChannel value={channel}>
        <Outlet />
      </CampaignSocketChannel>
    </CampaignSocketStatus>
  </AppShell>;
}
