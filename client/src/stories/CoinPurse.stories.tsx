import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { Coins } from '@quest-fast/shared';
import { CoinPurse } from '../components/CoinPurse';

function Example({ editable = true }: { editable?: boolean }) {
  const [coins, setCoins] = useState<Coins>({ cp: 12, sp: 30, ep: 0, gp: 122, pp: 2 });
  return (
    <div style={{ maxWidth: 520 }}>
      <CoinPurse key={JSON.stringify(coins)} coins={coins} editable={editable} onSave={setCoins} />
      <p className="text-small text-text-secondary" aria-live="polite" style={{ marginTop: 8 }}>Ouro salvo: {coins.gp}</p>
    </div>
  );
}

const meta = { title: 'Componentes/CoinPurse', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dono: Story = {};
export const Consulta: Story = { args: { editable: false } };

export const Salvar: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const gold = within(region).getByLabelText('Ouro (PO)');
      await userEvent.clear(gold);
      await userEvent.type(gold, '100');
      await userEvent.click(within(region).getByRole('button', { name: 'Salvar moedas' }));
      await expect(within(region).getByText('Ouro salvo: 100')).toBeVisible();
    }
  },
};
