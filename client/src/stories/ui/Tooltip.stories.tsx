import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiceSix, Heart, Shield } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

const actions = [
  { label: 'Rolar iniciativa', icon: DiceSix },
  { label: 'Curar', icon: Heart },
  { label: 'Defender', icon: Shield },
];

function Example() {
  return <TooltipProvider>
    <div className="flex gap-1">
      {actions.map(({ label, icon: Icon }) => <Tooltip key={label}>
        <TooltipTrigger asChild><Button variant="outline" size="icon" aria-label={label}><Icon size={20} aria-hidden="true" /></Button></TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>)}
    </div>
  </TooltipProvider>;
}

const meta = { title: 'Primitivos/Tooltip', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BarraDeAcoes: Story = { name: 'Barra de ações' };
