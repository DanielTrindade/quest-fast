import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';
const meta = { title: 'Componentes/EmptyState', component: EmptyState,
  args: { title: 'Sua mesa começa aqui', description: 'Crie uma campanha e convide as pessoas com quem você joga.', action: <Button>Criar campanha</Button> },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SemCampanhas: Story = {};
export const SemMembros: Story = { args: { title: 'Falta reunir a mesa', description: 'Compartilhe o código de convite para adicionar jogadores.', action: <Button variant="secondary">Convidar jogadores</Button> } };
