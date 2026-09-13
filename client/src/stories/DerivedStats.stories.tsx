import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DerivedStats } from '../components/DerivedStats';

const meta = {
  title: 'Componentes/DerivedStats',
  component: DerivedStats,
  args: { proficiency: 2, initiative: 2, speed: 9, size: 'medium', passivePerception: 11 },
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
} satisfies Meta<typeof DerivedStats>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Consulta: Story = {};
export const DonoRolaIniciativa: Story = { name: 'Dono rola iniciativa', args: { onRollInitiative: fn() } };
export const Negativos: Story = { args: { initiative: -1, speed: 7.5, size: 'small', passivePerception: 8, onRollInitiative: fn() } };
