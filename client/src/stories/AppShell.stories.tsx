import { useState } from 'react';
import { DiceFive, Scroll, Sword, UserPlus, Users } from '@phosphor-icons/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AppShell, type CampaignOption, type NavItem } from '../components/AppShell';

const CAMPAIGNS: CampaignOption[] = [
  { id: 'phandalin', name: 'Ecos de Phandalin', role: 'master' },
  { id: 'barovia', name: 'A névoa de Baróvia', role: 'player' },
];

function navigation(round?: number): NavItem[] {
  return [
    { id: 'characters', label: 'Personagens', href: '#personagens', icon: Users, group: 'Mesa' },
    { id: 'combat', label: 'Combate', href: '#combate', icon: Sword, group: 'Mesa', badge: round ? `Rodada ${round}` : undefined },
    { id: 'dice', label: 'Dados', href: '#dados', icon: DiceFive, group: 'Mesa' },
    { id: 'session', label: 'Sessão', href: '#sessao', icon: Scroll, group: 'Mesa' },
    { id: 'members', label: 'Membros e convite', shortLabel: 'Membros', href: '#membros', icon: UserPlus, group: 'Administração' },
  ];
}

function Example({ empty = false, startCollapsed = false, round, onSignOut = () => {} }: {
  empty?: boolean; startCollapsed?: boolean; round?: number; onSignOut?: () => void;
}) {
  const [campaign, setCampaign] = useState('phandalin');
  const [collapsed, setCollapsed] = useState(startCollapsed);
  return <AppShell campaigns={empty ? [] : CAMPAIGNS} campaignId={empty ? '' : campaign} onCampaignChange={setCampaign}
    onShowAllCampaigns={() => {}} navigation={navigation(round)} activeItem="characters"
    account={{ name: 'Lia Martins', avatarUrl: null, onSignOut }}
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
    await expect(canvas.getAllByRole('link', { name: 'Personagens' })[0]).toBeInTheDocument();
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
