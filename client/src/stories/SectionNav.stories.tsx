import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionNav } from '../components/SectionNav';
import type { NavItem } from '../components/AppShell';

const ITEMS: NavItem[] = [
  { id: 'characters', label: 'Personagens', href: '#characters-title' },
  { id: 'dice', label: 'Dados', href: '#dice-title' },
  // Fragmento de navegação; "#feed" não é uma cor hexadecimal.
  // eslint-disable-next-line local/no-raw-color
  { id: 'session', label: 'Sessão', href: '#feed-title' },
  { id: 'members', label: 'Membros e convite', href: '#members-title' },
];

function Nav({ activeItem = 'session' }: { activeItem?: string }) {
  return (
    <div className="qf-shell" style={{ maxWidth: 320 }}>
      <details className="qf-shell__mobile-nav" open>
        <summary>Navegação da campanha</summary>
        <SectionNav items={ITEMS} activeItem={activeItem} ariaLabel="Navegação da campanha" />
      </details>
    </div>
  );
}

const meta = { title: 'Componentes/SectionNav', component: Nav } satisfies Meta<typeof Nav>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SeccaoAtiva: Story = { name: 'Seção ativa', args: { activeItem: 'session' } };
export const SemAtiva: Story = { name: 'Sem seção ativa', args: { activeItem: '' } };