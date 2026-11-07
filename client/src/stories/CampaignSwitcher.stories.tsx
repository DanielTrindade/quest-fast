import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CampaignSwitcher, type CampaignOption } from '../components/CampaignSwitcher';

const CAMPAIGNS: CampaignOption[] = [
  { id: 'phandalin', name: 'Ecos de Phandalin', role: 'master' },
  { id: 'barovia', name: 'A névoa de Baróvia', role: 'player' },
  { id: 'long', name: 'A longa marcha pelas Montanhas Espinha do Mundo até Mirabar', role: 'player' },
];

function Switcher({ compact = false, empty = false }: { compact?: boolean; empty?: boolean }) {
  const [campaign, setCampaign] = useState('phandalin');
  return <div style={{ maxWidth: compact ? 64 : 248, padding: 8 }}>
    <CampaignSwitcher campaigns={empty ? [] : CAMPAIGNS} campaignId={empty ? '' : campaign}
      onCampaignChange={setCampaign} onShowAll={() => {}} compact={compact} />
  </div>;
}

const meta = { title: 'Componentes/CampaignSwitcher', component: Switcher } satisfies Meta<typeof Switcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = { name: 'Padrão' };
export const Compacto: Story = { args: { compact: true } };
export const SemCampanhas: Story = { name: 'Sem campanhas', args: { empty: true } };
export const Aberto: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    await userEvent.click(canvas.getByRole('button', { name: /Ecos de Phandalin/ }));
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await expect(within(menu).getByRole('menuitemradio', { name: /Ecos de Phandalin/ })).toHaveAttribute('aria-checked', 'true');
    // axe always flags aria-controls beside aria-haspopup as "needs review",
    // and Radix sets it only while open: end the story with the menu closed.
    await userEvent.keyboard('{Escape}');
    await expect(menu).not.toBeInTheDocument();
  },
};
