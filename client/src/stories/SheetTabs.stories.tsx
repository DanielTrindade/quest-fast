import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SheetTabPanel, SheetTabs } from '../components/SheetTabs';

function Example({ withError = false }: { withError?: boolean }) {
  const id = useId();
  const [active, setActive] = useState('character');
  const tabs = [
    { id: 'character', label: 'Personagem' },
    { id: 'spells', label: 'Magias', hasError: withError },
    { id: 'inventory', label: 'Inventário e história' },
  ];
  return (
    <div style={{ maxWidth: 520 }}>
      <SheetTabs tabs={tabs} active={active} onChange={setActive} idPrefix={id} label="Seções da ficha" />
      {tabs.map((tab) => (
        <SheetTabPanel key={tab.id} idPrefix={id} id={tab.id} active={active}>
          <p style={{ paddingTop: 16 }}>Conteúdo de {tab.label}.</p>
        </SheetTabPanel>
      ))}
    </div>
  );
}

const meta = { title: 'Componentes/SheetTabs', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = { name: 'Padrão' };
export const ComErro: Story = { name: 'Aba com erro', args: { withError: true } };

export const Teclado: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('tab', { name: 'Personagem' }));
      await userEvent.keyboard('{ArrowRight}');
      await expect(canvas.getByRole('tab', { name: 'Magias' })).toHaveAttribute('aria-selected', 'true');
      await expect(canvas.getByRole('tab', { name: 'Magias' })).toHaveFocus();
      await userEvent.keyboard('{End}');
      await expect(canvas.getByText('Conteúdo de Inventário e história.')).toBeVisible();
    }
  },
};
