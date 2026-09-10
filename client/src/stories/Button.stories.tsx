import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/Button';
import { DiceFive, Plus } from '@phosphor-icons/react';

const meta = {
  title: 'Componentes/Button',
  component: Button,
  args: { children: 'Salvar campanha' },
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primario: Story = { name: 'Primário' };
export const Secundario: Story = { name: 'Secundário', args: { variant: 'secondary' } };
export const Fantasma: Story = { args: { variant: 'ghost' } };
export const Perigo: Story = { args: { variant: 'danger', children: 'Excluir anotação' } };
export const Desabilitado: Story = { args: { disabled: true } };
export const Carregando: Story = { args: { loading: true, children: 'Salvando…' } };
export const Rolagem: Story = { args: { children: <><DiceFive size={18} weight="duotone" aria-hidden="true" />Rolar ataque</> } };
export const ComIcone: Story = { name: 'Com ícone', args: { variant: 'secondary', children: <><Plus size={18} aria-hidden="true" />Novo personagem</> } };
