import { useState } from 'react';
import { House, MapTrifold, Sword, UserPlus } from '@phosphor-icons/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CampaignNav, type NavItem } from '../components/CampaignNav';

const ITEMS: NavItem[] = [
  { id: 'overview', label: 'Visão geral', shortLabel: 'Início', href: '/campaigns/phandalin', icon: House, group: 'Mesa' },
  { id: 'table', label: 'Mesa', href: '/campaigns/phandalin/table', icon: MapTrifold, group: 'Mesa', badge: 'Rodada 2' },
  { id: 'prep', label: 'Preparo', href: '/campaigns/phandalin/prep', icon: Sword, group: 'Mesa' },
  { id: 'players', label: 'Jogadores', href: '/campaigns/phandalin/players', icon: UserPlus, group: 'Administração' },
];

function Nav({ activeItem = 'table', variant = 'list', collapsed = false }: {
  activeItem?: string; variant?: 'list' | 'bar'; collapsed?: boolean;
}) {
  const [active, setActive] = useState(activeItem);
  return (
    <div style={{ maxWidth: variant === 'bar' ? 390 : collapsed ? 64 : 248, padding: 8 }}>
      <CampaignNav items={ITEMS} activeItem={active} ariaLabel="Navegação da campanha" variant={variant} collapsed={collapsed}
        onNavigate={(href) => setActive(ITEMS.find((item) => item.href === href)?.id ?? '')} />
    </div>
  );
}

const meta = { title: 'Componentes/CampaignNav', component: Nav } satisfies Meta<typeof Nav>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TelaAtiva: Story = { name: 'Tela ativa', args: { activeItem: 'table' } };
export const Recolhida: Story = { args: { collapsed: true, activeItem: 'overview' } };
export const BarraInferior: Story = { name: 'Barra inferior', args: { variant: 'bar', activeItem: 'overview' } };

export const TrocarDeTela: Story = {
  name: 'Trocar de tela',
  args: { activeItem: 'overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    await userEvent.click(canvas.getByRole('link', { name: 'Jogadores' }));
    await expect(canvas.getByRole('link', { name: 'Jogadores' })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current');
  },
};
