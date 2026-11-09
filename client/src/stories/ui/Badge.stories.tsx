import type { Meta, StoryObj } from '@storybook/react-vite';
import { Crown, EyeSlash, User } from '@phosphor-icons/react';
import { Badge } from '../../components/ui/badge';

const meta = { title: 'Primitivos/Badge', component: Badge } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Variantes: Story = { render: () => <div className="flex flex-wrap items-center gap-3">
  <Badge variant="accent"><Crown aria-hidden="true" />Mestre</Badge>
  <Badge variant="secondary"><User aria-hidden="true" />Jogador</Badge>
  <Badge>Nível 5</Badge>
  <Badge variant="outline"><EyeSlash aria-hidden="true" />Secreto</Badge>
  <Badge variant="destructive">Caído</Badge>
</div> };
