import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { TurnView } from '@quest-fast/shared';
import { TurnPanel } from '../components/TurnPanel';

const fresh: TurnView = {
  actionUsed: false,
  bonusActionUsed: false,
  reactionUsed: false,
  attacksLeft: 0,
  extraActions: 0,
  dashes: 0,
  movementUsed: 0,
  speed: 9,
  movementLeft: 9,
  attacksPerAction: 2,
};

const meta = {
  title: 'Componentes/TurnPanel',
  component: TurnPanel,
  args: { name: 'Hazin Dan', turn: fresh, ownTurn: true, canAct: true, master: false, onSpend: fn(), onRefund: fn(), onGrant: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof TurnPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

function panel(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

export const InicioDoTurno: Story = {
  name: 'Início do turno',
  play: async ({ canvasElement, args }) => {
    const turn = panel(canvasElement);
    await expect(turn.getByText('restam 9 m de 9 m')).toBeVisible();
    await expect(turn.getByText('(6 casas)')).toBeVisible();
    await userEvent.click(turn.getByRole('button', { name: 'Usar ação bônus de Hazin Dan' }));
    await expect(args.onSpend).toHaveBeenLastCalledWith('bonusAction');
    await userEvent.click(turn.getByRole('button', { name: 'Disparada de Hazin Dan' }));
    await expect(args.onSpend).toHaveBeenLastCalledWith('dash');
  },
};

/** One attack of two made: the action is spent and one more attack is owed. */
export const NoMeioDoAtaque: Story = {
  name: 'No meio da ação Atacar',
  args: { turn: { ...fresh, actionUsed: true, attacksLeft: 1, movementUsed: 4.5, movementLeft: 4.5 } },
  play: async ({ canvasElement }) => {
    const turn = panel(canvasElement);
    await expect(turn.getByText(/Falta 1 ataque/)).toBeVisible();
    await expect(turn.getByRole('button', { name: 'Disparada de Hazin Dan' })).toBeDisabled();
    await expect(turn.queryByRole('button', { name: /Devolver/ })).toBeNull();
  },
};

/** Out of turn a player only reacts. */
export const ForaDoTurno: Story = {
  name: 'Fora do turno',
  args: { ownTurn: false },
  play: async ({ canvasElement, args }) => {
    const turn = panel(canvasElement);
    await expect(turn.getByRole('button', { name: 'Usar ação de Hazin Dan' })).toBeDisabled();
    await userEvent.click(turn.getByRole('button', { name: 'Usar reação de Hazin Dan' }));
    await expect(args.onSpend).toHaveBeenLastCalledWith('reaction');
  },
};

/** The master gives back and grants: Action Surge after a whole Attack action. */
export const Mestre: Story = {
  args: {
    master: true,
    turn: { ...fresh, actionUsed: true, bonusActionUsed: true, dashes: 1, movementUsed: 12, movementLeft: 6 },
  },
  play: async ({ canvasElement, args }) => {
    const turn = panel(canvasElement);
    await userEvent.click(turn.getByRole('button', { name: 'Devolver ação bônus de Hazin Dan' }));
    await expect(args.onRefund).toHaveBeenLastCalledWith('bonusAction');
    await userEvent.click(turn.getByRole('button', { name: 'Conceder ação a Hazin Dan' }));
    await expect(args.onGrant).toHaveBeenCalled();
    await expect(turn.getByText('restam 6 m de 18 m')).toBeVisible();
  },
};

export const Agarrado: Story = {
  name: 'Agarrado (deslocamento 0)',
  args: { turn: { ...fresh, speed: 0, movementLeft: 0 } },
};

/** Someone else's turn seen by a player: nothing to press. */
export const SoLeitura: Story = {
  name: 'Só leitura',
  args: { canAct: false, ownTurn: false, turn: { ...fresh, reactionUsed: true, extraActions: 1 } },
  play: async ({ canvasElement }) => {
    await expect(panel(canvasElement).queryByRole('button')).toBeNull();
  },
};

/** A goblin the bestiary read at 9 m: the master corrects it to 6 m and two attacks. */
export const AjusteDaCriatura: Story = {
  name: 'Ajuste da criatura (mestre)',
  args: { name: 'Goblin 1', master: true, adjust: { speed: 9, attacksPerAction: 1, onSave: fn() } },
  play: async ({ canvasElement, args }) => {
    const turn = panel(canvasElement);
    await userEvent.click(turn.getByText('Ajustar deslocamento e ataques'));
    const speed = turn.getByLabelText('Deslocamento (m)');
    await userEvent.clear(speed);
    await userEvent.type(speed, '61');
    await userEvent.click(turn.getByRole('button', { name: /^Salvar/ }));
    await expect(turn.getByText('Entre 0 e 60 metros.')).toBeVisible();
    await userEvent.clear(speed);
    await userEvent.type(speed, '6');
    const attacks = turn.getByLabelText('Ataques por ação');
    await userEvent.clear(attacks);
    await userEvent.type(attacks, '2');
    await userEvent.click(turn.getByRole('button', { name: /^Salvar/ }));
    await expect(args.adjust?.onSave).toHaveBeenLastCalledWith({ speed: 6, attacksPerAction: 2 });
  },
};
