import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HEALTH_BANDS } from '@quest-fast/shared';
import { HealthBand } from '../components/HealthBand';

const meta = {
  title: 'Componentes/HealthBand',
  component: HealthBand,
  args: { band: 'wounded' },
} satisfies Meta<typeof HealthBand>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What a player reads of a monster, from untouched to down. */
export const TodasAsFaixas: Story = {
  name: 'Todas as faixas',
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {HEALTH_BANDS.map((band) => <HealthBand key={band} band={band} />)}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    for (const label of ['Ileso', 'Ferido', 'Muito ferido', 'Derrotado']) {
      await expect(within(region!).getByText(label)).toBeVisible();
    }
  },
};

export const Ferido: Story = {};
