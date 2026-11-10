import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

function Example() {
  const id = useId();
  return <div className="grid max-w-sm gap-6">
    <div className="grid gap-2">
      <Label htmlFor={`${id}-name`}>Nome da campanha</Label>
      <Input id={`${id}-name`} placeholder="Ex.: Ecos de Phandalin" />
    </div>
    <div className="grid gap-2">
      <Label htmlFor={`${id}-code`}>Código de convite</Label>
      <Input id={`${id}-code`} defaultValue="MESA4" aria-invalid="true" aria-describedby={`${id}-code-error`} />
      <p id={`${id}-code-error`} className="text-small text-danger-text">O código tem seis caracteres.</p>
    </div>
    <div className="grid gap-2">
      <Label htmlFor={`${id}-system`}>Sistema</Label>
      <Input id={`${id}-system`} defaultValue="D&D 5e (2024)" disabled />
    </div>
  </div>;
}

const meta = { title: 'Primitivos/Formulário', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Campos: Story = {};
