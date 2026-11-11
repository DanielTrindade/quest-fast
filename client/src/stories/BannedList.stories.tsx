import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import type { CampaignBan } from '@quest-fast/shared';
import { BannedList } from '../components/BannedList';

const bans: CampaignBan[] = [
  { userId: 'u1', name: 'Rafael Costa', avatarUrl: null, bannedAt: '2026-11-01T12:00:00.000Z' },
  { userId: 'u2', name: 'Ana Beatriz', avatarUrl: null, bannedAt: '2026-11-02T12:00:00.000Z' },
];

const longBans: CampaignBan[] = [
  { userId: 'u1', name: 'Bartolomeu de Albuquerque-Nascimento Villa-Lobos Segundo da Silva Pereira Santos', avatarUrl: null, bannedAt: '2026-11-01T12:00:00.000Z' },
  { userId: 'u2', name: 'mestre.com.nome.extremamente.longo.sem.espacos@exemplo-de-dominio-muito-comprido.com.br', avatarUrl: null, bannedAt: '2026-11-02T12:00:00.000Z' },
];

function Example({ initial, unbanning }: { initial: CampaignBan[]; unbanning?: string }) {
  const [list, setList] = useState(initial);
  return <div className="mx-auto w-full max-w-md p-4">
    <BannedList bans={list} unbanning={unbanning} onUnban={id => setList(current => current.filter(ban => ban.userId !== id))} />
  </div>;
}

const meta = { title: 'Componentes/BannedList', component: Example, args: { initial: bans } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('button', { name: 'Liberar entrada de Rafael Costa' }));
      await waitFor(() => expect(canvas.queryByText('Rafael Costa')).not.toBeInTheDocument());
      await expect(canvas.getByText('Ana Beatriz')).toBeInTheDocument();
    }
  },
};

export const Liberando: Story = { args: { unbanning: 'u1' } };

export const NomesLongos: Story = { args: { initial: longBans } };
