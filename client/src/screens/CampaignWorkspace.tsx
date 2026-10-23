import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AppShell, type NavItem } from '../components/AppShell';
import { useActiveSection } from '../hooks/useActiveSection';
import { api } from '../lib/api';
import { encountersQuery } from '../lib/combat-cache';
import { AccountControls } from './AccountBar';
import { Campaign } from './Campaign';

const NAVIGATION: NavItem[] = [
  { id: 'characters', label: 'Personagens', href: '#characters-title' },
  { id: 'combat', label: 'Combate', href: '#combat-title' },
  { id: 'dice', label: 'Dados', href: '#dice-title' },
  // Fragmento de navegação; "#feed" não é uma cor hexadecimal.
  // eslint-disable-next-line local/no-raw-color
  { id: 'session', label: 'Sessão', href: '#feed-title' },
  { id: 'members', label: 'Membros e convite', href: '#members-title' },
];

// A player gets the combat section once a fight has started (never one in
// preparation, which the server does not list for them).
const NO_COMBAT_NAVIGATION = NAVIGATION.filter((item) => item.id !== 'combat');

// Each item's anchor names the heading the section observer watches. The
// combat heading is absent for a player without a fight, and the observer skips it.
const SECTION_IDS = NAVIGATION.map((item) => item.href.slice(1));

export function CampaignWorkspace({ campaignId, user }: {
  campaignId: string; user: { name: string; avatarUrl: string | null };
}) {
  const navigate = useNavigate();
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  const campaign = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.campaign(campaignId) });
  const encounters = useQuery(encountersQuery(campaignId));
  const showCombat = campaign.data?.role === 'master' || (encounters.data?.encounters.length ?? 0) > 0;
  const options = campaigns.data?.campaigns ?? [];
  // A direct link can resolve before the list. Keep the selected campaign
  // represented without substituting a different campaign in the control.
  const available = options.some(option => option.id === campaignId)
    ? options
    : [{ id: campaignId, name: campaign.data?.name ?? 'Campanha atual' }, ...options];

  // The nav follows the section in view instead of a fixed active item. The
  // observer reports heading ids; the nav speaks in item ids.
  const activeSection = useActiveSection(SECTION_IDS);
  const activeItem = NAVIGATION.find((item) => item.href === `#${activeSection}`)?.id ?? '';

  return <AppShell campaigns={available} campaignId={campaignId}
    onCampaignChange={id => { void navigate({ to: '/campaigns/$campaignId', params: { campaignId: id } }); }}
    navigation={showCombat ? NAVIGATION : NO_COMBAT_NAVIGATION}
    activeItem={activeItem} user={<AccountControls {...user} />}>
    <Campaign campaignId={campaignId} />
  </AppShell>;
}
