import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from '../components/AppShell';
import { Avatar } from '../components/Avatar';

function Example({ empty = false }: { empty?: boolean }) {
  const [campaign, setCampaign] = useState('phandalin');
  return <AppShell campaigns={empty ? [] : [{ id: 'phandalin', name: 'Ecos de Phandalin' }, { id: 'strahd', name: 'A névoa de Baróvia' }]}
    campaignId={empty ? '' : campaign} onCampaignChange={setCampaign} activeItem="members"
    navigation={[{ id: 'members', label: 'Membros', href: '#membros' }, { id: 'campaign', label: 'Campanha', href: '#campanha' }]}
    user={<Avatar name="Lia Martins" />}>
    <h1 className="font-display text-h1">{empty ? 'Suas campanhas' : 'Membros da campanha'}</h1>
    <p className="mt-3 text-text-secondary">{empty ? 'Crie sua primeira campanha para reunir a mesa.' : 'Convide jogadores e organize quem participa da próxima sessão.'}</p>
  </AppShell>;
}
const meta = { title: 'Componentes/AppShell', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ComCampanhas: Story = {};
export const SemCampanhas: Story = { args: { empty: true } };
