import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sword } from '@phosphor-icons/react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';

function Example() {
  return <Card className="max-w-md">
    <CardHeader>
      <CardTitle asChild><h2>Thalia Brasa</h2></CardTitle>
      <CardDescription>Guerreira 5 · Humana</CardDescription>
      <CardAction><Badge variant="secondary">CA 18</Badge></CardAction>
    </CardHeader>
    <CardContent>
      <dl className="grid grid-cols-3 gap-4">
        {[['PV', '44/44'], ['Iniciativa', '+2'], ['Desloc.', '9 m']].map(([label, value]) => <div key={label} className="grid gap-1">
          <dt className="text-micro text-text-muted">{label}</dt>
          <dd className="font-mono text-h2 tabular-nums">{value}</dd>
        </div>)}
      </dl>
    </CardContent>
    <CardFooter className="justify-end">
      <Button variant="secondary">Abrir ficha</Button>
      <Button><Sword size={18} aria-hidden="true" />Atacar</Button>
    </CardFooter>
  </Card>;
}

const meta = { title: 'Primitivos/Card', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Personagem: Story = {};
