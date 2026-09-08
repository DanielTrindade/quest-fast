import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../components/Badge';
const meta = { title: 'Componentes/Badge', component: Badge, args: { role: 'master' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Mestre: Story = {};
export const Jogador: Story = { args: { role: 'player' } };
