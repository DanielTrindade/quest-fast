import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

function Example() {
  return <Tabs defaultValue="combat" className="max-w-lg">
    <TabsList aria-label="Seções da ficha">
      <TabsTrigger value="combat">Combate</TabsTrigger>
      <TabsTrigger value="spells">Magias</TabsTrigger>
      <TabsTrigger value="gear">Equipamento</TabsTrigger>
    </TabsList>
    <TabsContent value="combat" className="text-muted-foreground">Ataques, PV e testes contra a morte.</TabsContent>
    <TabsContent value="spells" className="text-muted-foreground">Espaços de magia e magias preparadas.</TabsContent>
    <TabsContent value="gear" className="text-muted-foreground">Itens, moedas e sintonia.</TabsContent>
  </Tabs>;
}

const meta = { title: 'Primitivos/Tabs', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const Teclado: Story = { play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('tab', { name: 'Combate' }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Magias' })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Espaços de magia');
  }
} };
