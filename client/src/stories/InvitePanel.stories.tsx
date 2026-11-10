import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { InvitePanel } from '../components/InvitePanel';

const invite = {
  campaignName: 'Ecos de Phandalin',
  master: { name: 'Lia Martins', avatarUrl: null },
  playerCount: 3,
};

function Example(props: Partial<ComponentProps<typeof InvitePanel>>) {
  return <InvitePanel state="anonymous" invite={invite} loginHref="#discord" campaignsHref="#campanhas" {...props} />;
}

const meta = {
  title: 'Componentes/InvitePanel',
  component: Example,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Carregando: Story = { args: { state: 'loading', invite: undefined } };

export const Anonimo: Story = { name: 'Anônimo' };

export const LoginFalhou: Story = { args: { failed: true } };

export const Convidado: Story = { args: { state: 'guest' } };

export const Entrando: Story = { args: { state: 'guest', joining: true } };

export const ErroAoEntrar: Story = {
  args: { state: 'guest', joinError: 'Não foi possível entrar na mesa. Tente de novo.' },
};

export const Bloqueado: Story = { args: { state: 'blocked', invite: undefined } };

export const Invalido: Story = { name: 'Inválido', args: { state: 'invalid', invite: undefined } };

export const SemJogadores: Story = { args: { invite: { ...invite, playerCount: 0 } } };

export const UmJogador: Story = { args: { state: 'guest', invite: { ...invite, playerCount: 1 } } };

export const NomeLongo: Story = {
  args: {
    state: 'guest',
    invite: {
      campaignName: 'A Crônica Interminável dos Reinos Esquecidos e das Terras Ermas Além do Mar de Espadas '.repeat(2)
        + 'Supercalifragilisticoexpialidosoimpossivelmentelongosemquebras',
      master: {
        name: 'Mestre Bartolomeu de Albuquerque-Nascimento Villa-Lobos Segundo '
          + 'mestre.com.nome.extremamente.longo.sem.espacos@exemplo-de-dominio-muito-comprido.com.br',
        avatarUrl: null,
      },
      playerCount: 1284,
    },
  },
};

function JoinExample() {
  const [joining, setJoining] = useState(false);
  return <Example state="guest" joining={joining} onJoin={() => setJoining(true)} />;
}

export const EntrarNaMesa: Story = {
  render: () => <JoinExample />,
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.click(canvas.getByRole('button', { name: 'Entrar na mesa' }));
      await expect(canvas.getByRole('button', { name: 'Entrar na mesa' })).toBeDisabled();
    }
  },
};
