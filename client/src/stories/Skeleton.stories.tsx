import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from '../components/Skeleton';
const meta = { title: 'Componentes/Skeleton', component: Skeleton } satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Linha: Story = {};
export const Avatar: Story = { args: { shape: 'avatar' } };
export const Painel: Story = { args: { shape: 'panel' } };
export const Membro: Story = { render: () => <div className="flex items-center gap-3">
  <Skeleton shape="avatar" /><div className="grid flex-1 gap-3"><Skeleton width="60%" /><Skeleton width="85%" /></div>
</div> };
