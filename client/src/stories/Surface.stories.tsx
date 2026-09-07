import type { Meta, StoryObj } from '@storybook/react-vite';
import { Surface } from '../components/Surface';

const meta = {
  title: 'Componentes/Surface', component: Surface,
  args: { children: 'Anotações da sessão. Conteúdo ilustrativo.', variant: 'raised' },
} satisfies Meta<typeof Surface>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Base: Story = { args: { variant: 'base' } };
export const Elevada: Story = {};
export const Sobreposta: Story = { args: { variant: 'overlay' } };
export const Secreta: Story = { args: { variant: 'secret', children: 'Edgar trai o grupo no capítulo 3. Anotação ilustrativa do mestre.' } };
