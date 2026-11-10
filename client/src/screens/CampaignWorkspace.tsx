import { DiceFive, Scroll, Sword, UserPlus, Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AppShell, type NavItem } from '../components/AppShell';
import { useActiveSection } from '../hooks/useActiveSection';
import { useStoredFlag } from '../hooks/useStoredFlag';
import { api } from '../lib/api';
import { encountersQuery } from '../lib/combat-cache';
import { useSignOut } from '../hooks/useSignOut';
import { Campaign } from './Campaign';

const NAVIGATION: NavItem[] = [
  { id: 'characters', label: 'Personagens', shortLabel: 'Fichas', href: '#characters-title', icon: Users, group: 'Mesa' },
  { id: 'combat', label: 'Combate', href: '#combat-title', icon: Sword, group: 'Mesa' },
  { id: 'dice', label: 'Dados', href: '#dice-title', icon: DiceFive, group: 'Mesa' },
  // Fragmento de navegação; "#feed" não é uma cor hexadecimal.
  // eslint-disable-next-line local/no-raw-color
  { id: 'session', label: 'Sessão', href: '#feed-title', icon: Scroll, group: 'Mesa' },
  { id: 'members', label: 'Membros e convite', shortLabel: 'Membros', href: '#members-title', icon: UserPlus, group: 'Administração' },
];

// Each item's anchor names the heading the section observer watches. The
// combat heading is absent for a player without a fight, and the observer skips it.
const SECTION_IDS = NAVIGATION.map((item) => item.href.slice(1));

export function CampaignWorkspace({ campaignId, user }: {
  campaignId: string; user: { name: string; avatarUrl: string | null };
}) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [collapsed, setCollapsed] = useStoredFlag('quest-fast:sidebar-collapsed');
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  const campaign = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.campaign(campaignId) });
  const encounters = useQuery(encountersQuery(campaignId));
  const fights = encounters.data?.encounters ?? [];
  // A player gets the combat section once a fight has started (never one in
  // preparation, which the server does not list for them).
  const showCombat = campaign.data?.role === 'master' || fights.length > 0;
  const activeFight = fights.find((fight) => fight.status === 'active');
  const navigation = NAVIGATION.flatMap((item) => {
    if (item.id !== 'combat') return [item];
    if (!showCombat) return [];
    return [activeFight ? { ...item, badge: `Rodada ${activeFight.round}` } : item];
  });

  const options = campaigns.data?.campaigns ?? [];
  // A direct link can resolve before the list. Keep the selected campaign
  // represented without substituting a different campaign in the control.
  const available = options.some(option => option.id === campaignId)
    ? options
    : [{ id: campaignId, name: campaign.data?.name ?? 'Campanha atual', role: campaign.data?.role }, ...options];

  // The nav follows the section in view instead of a fixed active item. The
  // observer reports heading ids; the nav speaks in item ids.
  const activeSection = useActiveSection(SECTION_IDS);
  const activeItem = NAVIGATION.find((item) => item.href === `#${activeSection}`)?.id ?? '';

  return <AppShell campaigns={available} campaignId={campaignId}
    onCampaignChange={id => { void navigate({ to: '/campaigns/$campaignId', params: { campaignId: id } }); }}
    onShowAllCampaigns={() => { void navigate({ to: '/campaigns' }); }}
    navigation={navigation} activeItem={activeItem}
    account={{ ...user, onSignOut: () => signOut.mutate(), signingOut: signOut.isPending }}
    collapsed={collapsed} onCollapsedChange={setCollapsed}>
    <Campaign campaignId={campaignId} />
  </AppShell>;
}
