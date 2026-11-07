import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CampaignSwitcher, type CampaignOption } from '../components/CampaignSwitcher';

const CAMPAIGNS: CampaignOption[] = [
  { id: 'phandalin', name: 'Ecos de Phandalin', role: 'master' },
  { id: 'barovia', name: 'A névoa de Baróvia', role: 'player' },
  { id: 'long', name: 'A longa marcha pelas Montanhas Espinha do Mundo até Mirabar', role: 'player' },
];

// The API accepts 80 characters with no space requirement.
const UNBROKEN_NAME = 'W'.repeat(80);
const MANY: CampaignOption[] = [
  ...CAMPAIGNS,
  { id: 'unbroken', name: UNBROKEN_NAME, role: 'player' },
  ...Array.from({ length: 16 }, (_, index) => ({ id: `mesa-${index + 1}`, name: `Mesa de sexta ${index + 1}`, role: 'player' as const })),
];

function Switcher({ compact = false, empty = false, many = false, initial = 'phandalin' }: {
  compact?: boolean; empty?: boolean; many?: boolean; initial?: string;
}) {
  const [campaign, setCampaign] = useState(initial);
  return <div style={{ maxWidth: compact ? 64 : 248, padding: 8 }}>
    <CampaignSwitcher campaigns={empty ? [] : many ? MANY : CAMPAIGNS} campaignId={empty ? '' : campaign}
      onCampaignChange={setCampaign} onShowAll={() => {}} compact={compact} />
  </div>;
}

const meta = { title: 'Componentes/CampaignSwitcher', component: Switcher } satisfies Meta<typeof Switcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = { name: 'Padrão' };
export const Compacto: Story = { args: { compact: true } };
export const SemCampanhas: Story = { name: 'Sem campanhas', args: { empty: true } };
export const NomeSemEspacos: Story = { name: 'Nome sem espaços', args: { many: true, initial: 'unbroken' } };

export const ListaLonga: Story = {
  name: 'Lista longa',
  args: { many: true },
  play: async ({ canvasElement }) => {
    const canvas = within(within(canvasElement).getAllByRole('region', { name: /^Tema / })[0]);
    await userEvent.click(canvas.getByRole('button', { name: /Ecos de Phandalin/ }));
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    const view = canvasElement.ownerDocument.defaultView!;
    const box = menu.getBoundingClientRect();
    await expect(box.bottom).toBeLessThanOrEqual(view.innerHeight);
    await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    // No name, however long, pushes the menu wider than its box.
    await expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
    const unbroken = within(menu).getByRole('menuitemradio', { name: new RegExp(UNBROKEN_NAME) });
    await expect(unbroken.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
    // The last action stays reachable from the keyboard, scrolled into view.
    await userEvent.keyboard('{End}');
    const showAll = within(menu).getByRole('menuitem', { name: 'Ver todas as campanhas' });
    await expect(showAll).toHaveFocus();
    await expect(showAll.getBoundingClientRect().bottom).toBeLessThanOrEqual(menu.getBoundingClientRect().bottom + 1);
    // axe always flags aria-controls beside aria-haspopup as "needs review",
    // and Radix sets it only while open: end the story with the menu closed.
    await userEvent.keyboard('{Escape}');
    await expect(menu).not.toBeInTheDocument();
  },
};

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
