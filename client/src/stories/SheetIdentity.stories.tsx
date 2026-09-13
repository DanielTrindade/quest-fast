import type { Meta, StoryObj } from '@storybook/react-vite';
import { SheetIdentity } from '../components/SheetIdentity';

const meta = {
  title: 'Componentes/SheetIdentity',
  component: SheetIdentity,
  args: { backgroundName: 'Fazendeiro', species: 'Humano', className: 'Bárbaro', subclass: 'Berserker', level: 4, experience: 1500 },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof SheetIdentity>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HazinDan: Story = {};
export const SemSubclasse: Story = { name: 'Nível 1, sem subclasse', args: { subclass: '', backgroundName: '', level: 1, experience: 0 } };
export const Extenso: Story = {
  name: 'Textos extensos',
  args: { subclass: 'Caminho do Berserker das Montanhas do Norte', backgroundName: 'Fazendeiro das terras altas', level: 20, experience: 355000 },
};
