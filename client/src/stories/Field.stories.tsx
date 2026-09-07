import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from '../components/Field';

const meta = {
  title: 'Componentes/Field', component: Field,
  args: { label: 'Nome da campanha', placeholder: 'Ex.: Ecos de Phandalin', hint: 'Escolha um nome que a mesa reconheça.' },
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const Erro: Story = { args: { error: 'Informe o nome da campanha.', required: true } };
export const Desabilitado: Story = { args: { disabled: true, defaultValue: 'Ecos de Phandalin' } };
