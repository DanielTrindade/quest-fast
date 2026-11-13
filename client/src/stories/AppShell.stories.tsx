import { useState } from 'react';
import { Books, House, MapTrifold, Sword, UserCircle, UserPlus } from '@phosphor-icons/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AppShell, type CampaignOption, type NavItem } from '../components/AppShell';

const CAMPAIGNS: CampaignOption[] = [
  { id: 'phandalin', name: 'Ecos de Phandalin', role: 'master' },
  { id: 'barovia', name: 'A névoa de Baróvia', role: 'player' },
];

function navigation(round?: number): NavItem[] {
  return [
    { id: 'overview', label: 'Visão geral', shortLabel: 'Início', href: '/campaigns/phandalin', icon: House, group: 'Mesa' },
    { id: 'table', label: 'Mesa', href: '/campaigns/phandalin/table', icon: MapTrifold, group: 'Mesa', badge: round ? `Rodada ${round}` : undefined },
    { id: 'prep', label: 'Preparo', href: '/campaigns/phandalin/prep', icon: Sword, group: 'Mesa' },
    { id: 'players', label: 'Jogadores', href: '/campaigns/phandalin/players', icon: UserPlus, group: 'Administração' },
  ];
}

const ACCOUNT_LINKS: NavItem[] = [
  { id: 'campaigns', label: 'Campanhas', href: '/campaigns', icon: Books, group: 'Sua conta' },
  { id: 'characters', label: 'Meus personagens', href: '/characters', icon: UserCircle, group: 'Sua conta' },
];

function Example({ empty = false, startCollapsed = false, round, onSignOut = () => {} }: {
  empty?: boolean; startCollapsed?: boolean; round?: number; onSignOut?: () => void;
}) {
  const [campaign, setCampaign] = useState('phandalin');
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [active, setActive] = useState('overview');
  const items = navigation(round);
  return <AppShell campaigns={empty ? [] : CAMPAIGNS} campaignId={empty ? '' : campaign} onCampaignChange={setCampaign}
    onShowAllCampaigns={() => {}} navigation={items} activeItem={active}
    onNavigate={(href) => setActive(items.find((item) => item.href === href)?.id ?? '')}
    account={{ name: 'Lia Martins', avatarUrl: null, onSignOut }} accountLinks={ACCOUNT_LINKS}
    collapsed={collapsed} onCollapsedChange={setCollapsed}>
    <h1 className="font-display text-h1">{empty ? 'Suas campanhas' : CAMPAIGNS.find(item => item.id === campaign)?.name}</h1>
    <p className="mt-3 text-text-secondary">{empty ? 'Crie sua primeira campanha para reunir a mesa.' : 'Convide jogadores e organize quem participa da próxima sessão.'}</p>
  </AppShell>;
}

const meta = { title: 'Componentes/AppShell', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Expandido: Story = {};
export const Recolhido: Story = { args: { startCollapsed: true } };
export const CombateEmAndamento: Story = { name: 'Combate em andamento', args: { round: 3 } };
export const SemCampanhas: Story = { name: 'Sem campanhas', args: { empty: true } };

export const AtalhosDaConta: Story = {
  name: 'Meus personagens ao alcance dentro da campanha',
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    // Sidebar on wide containers, phone header on narrow ones: either way it is there.
    const account = canvas.getAllByRole('navigation', { name: 'Sua conta' }).find((nav) => nav.getClientRects().length > 0)!;
    await expect(within(account).getByRole('link', { name: 'Meus personagens' })).toHaveAttribute('href', '/characters');
    await expect(within(account).getByRole('link', { name: 'Campanhas' })).toHaveAttribute('href', '/campaigns');
  },
};

export const RecolherEExpandir: Story = {
  name: 'Recolher e expandir',
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    // Narrow containers have the tab bar instead of the sidebar.
    const toggle = canvas.queryByRole('button', { name: 'Recolher menu' });
    if (!toggle) return;
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    const expand = canvas.getByRole('button', { name: 'Expandir menu' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect(expand).toHaveFocus();
    await expect(canvas.getAllByRole('link', { name: 'Visão geral' })[0]).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    const collapse = canvas.getByRole('button', { name: 'Recolher menu' });
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await expect(collapse).toHaveFocus();
  },
};

export const TrocarCampanha: Story = {
  name: 'Trocar campanha',
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    const [trigger] = canvas.getAllByRole('button', { name: /Ecos de Phandalin/ });
    await userEvent.click(trigger);
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitemradio', { name: /A névoa de Baróvia/ }));
    await expect(canvas.getByRole('heading', { name: 'A névoa de Baróvia' })).toBeInTheDocument();
  },
};

export const Sair: Story = {
  args: { onSignOut: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Conta de Lia Martins' })[0]);
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Sair' }));
    await expect(args.onSignOut).toHaveBeenCalled();
  },
};
