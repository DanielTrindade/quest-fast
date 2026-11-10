import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiceFive, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';

const meta = {
  title: 'Primitivos/Button',
  component: Button,
  args: { children: 'Salvar campanha' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const Variantes: Story = { render: () => <div className="flex flex-wrap items-center gap-3">
  <Button><DiceFive size={18} weight="duotone" aria-hidden="true" />Rolar ataque</Button>
  <Button variant="secondary"><Plus size={18} aria-hidden="true" />Novo personagem</Button>
  <Button variant="outline">Ver ficha</Button>
  <Button variant="ghost">Cancelar</Button>
  <Button variant="destructive"><Trash size={18} aria-hidden="true" />Excluir anotação</Button>
  <Button variant="link">Ver todas as campanhas</Button>
</div> };
export const Tamanhos: Story = { render: () => <div className="flex flex-wrap items-center gap-3">
  <Button size="sm">Pequeno</Button>
  <Button>Padrão</Button>
  <Button size="lg">Grande</Button>
  <Button size="icon" variant="secondary" aria-label="Adicionar"><Plus size={20} aria-hidden="true" /></Button>
</div> };
export const Desabilitado: Story = { args: { disabled: true } };
