import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { CaretUpDown, SignOut } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

const campaigns = [{ id: 'phandalin', name: 'Ecos de Phandalin' }, { id: 'barovia', name: 'A névoa de Baróvia' }];

function Example() {
  const [campaign, setCampaign] = useState('phandalin');
  const current = campaigns.find(item => item.id === campaign)!;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="secondary" aria-label={`Campanha: ${current.name}`}>{current.name}<CaretUpDown size={16} aria-hidden="true" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuLabel>Suas campanhas</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={campaign} onValueChange={setCampaign}>
        {campaigns.map(item => <DropdownMenuRadioItem key={item.id} value={item.id}>{item.name}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive"><SignOut size={18} aria-hidden="true" />Sair</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

const meta = { title: 'Primitivos/DropdownMenu', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const TrocarCampanha: Story = { name: 'Trocar campanha', play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('button', { name: 'Campanha: Ecos de Phandalin' }));
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'A névoa de Baróvia' }));
    await waitFor(() => expect(canvas.queryByRole('menu')).not.toBeInTheDocument());
    await expect(canvas.getByRole('button', { name: 'Campanha: A névoa de Baróvia' })).toHaveFocus();
  }
} };
