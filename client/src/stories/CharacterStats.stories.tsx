import type { Meta, StoryObj } from '@storybook/react-vite';
import { CharacterStats } from '../components/CharacterStats';

const meta = { title: 'Componentes/CharacterStats', component: CharacterStats,
  args: { hp: 24, ac: 15, proficiency: 2 },
} satisfies Meta<typeof CharacterStats>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = {};
export const NivelAlto: Story = { args: { hp: 148, ac: 21, proficiency: 6 } };
export const SemPontosDeVida: Story = { args: { hp: 0 } };
