import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TurnBar } from '../components/TurnBar';

const meta = {
  title: 'Componentes/TurnBar',
  component: TurnBar,
  args: { status: 'active', round: 3, activeName: 'Goblin 2', master: true, onAction: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 880 }}><Story /></div>],
} satisfies Meta<typeof TurnBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MestreEmPreparacao: Story = {
  name: 'Mestre: em preparação',
  args: { status: 'preparing', round: 0, activeName: null },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await userEvent.click(within(region).getByRole('button', { name: 'Iniciar combate' }));
    await expect(args.onAction).toHaveBeenCalledWith('start');
  },
};

export const MestreAguardandoIniciativa: Story = {
  name: 'Mestre: aguardando iniciativa',
  args: { round: 0, activeName: null, missingInitiative: 2, monstersWithoutInitiative: 1 },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const bar = within(region);
    await expect(bar.getByRole('button', { name: 'Começar round 1' })).toBeDisabled();
    await expect(bar.getByText('Falta a iniciativa de 2 combatentes.')).toBeVisible();
  },
};

export const MestreProntoParaComecar: Story = {
  name: 'Mestre: pronto para o round 1',
  args: { round: 0, activeName: null },
};

export const MestreEmCombate: Story = {
  name: 'Mestre: em combate',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const bar = within(region);
    await expect(bar.getByRole('status')).toHaveTextContent('Vez de Goblin 2.');
    await userEvent.click(bar.getByRole('button', { name: /Próximo turno/ }));
    await expect(args.onAction).toHaveBeenCalledWith('next');
    await userEvent.click(bar.getByRole('button', { name: /Voltar turno/ }));
    await expect(args.onAction).toHaveBeenCalledWith('previous');
  },
};

export const MestrePrimeiroTurno: Story = {
  name: 'Mestre: primeiro turno do round 1',
  args: { round: 1, activeName: 'Goblin 1', canGoBack: false },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const bar = within(region);
    const back = bar.getByRole('button', { name: /Voltar turno/ });
    await expect(back).toBeDisabled();
    await expect(back).toHaveAccessibleDescription('Ainda não há turno anterior.');
    await expect(bar.getByRole('button', { name: /Próximo turno/ })).toBeEnabled();
  },
};

export const EsperandoServidor: Story = {
  name: 'Esperando o servidor',
  args: { pending: 'next' },
};

export const EncerrarEmDoisPassos: Story = {
  name: 'Encerrar em dois passos',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const bar = within(region);
    await userEvent.click(bar.getByRole('button', { name: 'Encerrar combate' }));
    await expect(args.onAction).not.toHaveBeenCalled();
    await userEvent.click(bar.getByRole('button', { name: 'Encerrar e registrar resumo' }));
    await expect(args.onAction).toHaveBeenCalledWith('end');
  },
};

export const JogadorNaSuaVez: Story = {
  name: 'Jogador: é a sua vez',
  args: { master: false, ownTurn: true, activeName: 'Hazin Dan' },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const bar = within(region);
    await expect(bar.getByRole('status')).toHaveTextContent('É a sua vez.');
    await expect(bar.queryByRole('button', { name: /Voltar turno/ })).toBeNull();
    await userEvent.click(bar.getByRole('button', { name: /Encerrar meu turno/ }));
    await expect(args.onAction).toHaveBeenCalledWith('next');
  },
};

export const JogadorVezDeOutro: Story = {
  name: 'Jogador: vez de outro',
  args: { master: false, activeName: 'Lyra Ventoclaro' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region).queryByRole('button')).toBeNull();
  },
};

export const JogadorCombatenteEscondido: Story = {
  name: 'Jogador: combatente escondido',
  args: { master: false, activeName: null, activeHidden: true },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region).getByRole('status')).toHaveTextContent('Vez de outro combatente.');
  },
};

export const Encerrado: Story = {
  args: { status: 'ended', round: 4, activeName: null },
};

export const NomeLongo: Story = {
  name: 'Nome longo',
  args: { activeName: 'Guardião Esquecido das Catacumbas Submersas de Vel’Tharon', round: 12 },
};
