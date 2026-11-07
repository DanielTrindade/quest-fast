import { DiceFive, Scroll, Sword, UserPlus, Users } from '@phosphor-icons/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionNav, type NavItem } from '../components/SectionNav';

const ITEMS: NavItem[] = [
  { id: 'characters', label: 'Personagens', href: '#characters-title', icon: Users, group: 'Mesa' },
  { id: 'combat', label: 'Combate', href: '#combat-title', icon: Sword, group: 'Mesa', badge: 'Rodada 2' },
  { id: 'dice', label: 'Dados', href: '#dice-title', icon: DiceFive, group: 'Mesa' },
  // Fragmento de navegação; "#feed" não é uma cor hexadecimal.
  // eslint-disable-next-line local/no-raw-color
  { id: 'session', label: 'Sessão', href: '#feed-title', icon: Scroll, group: 'Mesa' },
  { id: 'members', label: 'Membros e convite', shortLabel: 'Membros', href: '#members-title', icon: UserPlus, group: 'Administração' },
];

function Nav({ activeItem = 'session', variant = 'list', collapsed = false }: {
  activeItem?: string; variant?: 'list' | 'bar'; collapsed?: boolean;
}) {
  return (
    <div style={{ maxWidth: variant === 'bar' ? 390 : collapsed ? 64 : 248, padding: 8 }}>
      <SectionNav items={ITEMS} activeItem={activeItem} ariaLabel="Navegação da campanha" variant={variant} collapsed={collapsed} />
    </div>
  );
}

const meta = { title: 'Componentes/SectionNav', component: Nav } satisfies Meta<typeof Nav>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SeccaoAtiva: Story = { name: 'Seção ativa', args: { activeItem: 'session' } };
export const SemAtiva: Story = { name: 'Sem seção ativa', args: { activeItem: '' } };
export const Recolhida: Story = { args: { collapsed: true, activeItem: 'combat' } };
export const BarraInferior: Story = { name: 'Barra inferior', args: { variant: 'bar', activeItem: 'characters' } };
