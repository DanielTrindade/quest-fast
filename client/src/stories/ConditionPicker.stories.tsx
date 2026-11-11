import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CONDITIONS } from '@quest-fast/shared';
import { ConditionPicker } from '../components/ConditionPicker';

const meta = {
  title: 'Componentes/ConditionPicker',
  component: ConditionPicker,
  args: {
    name: 'Hazin Dan',
    conditions: [{ condition: 'poisoned', roundsLeft: 2 }, { condition: 'exhaustion', level: 2 }],
    onApply: fn(),
    onRemove: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof ConditionPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ComCondicoes: Story = {
  name: 'Com condições',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const picker = within(region!);
    await userEvent.click(picker.getByRole('button', { name: 'Remover Envenenado de Hazin Dan' }));
    await expect(args.onRemove).toHaveBeenCalledWith('poisoned');

    await userEvent.selectOptions(picker.getByLabelText('Condição'), 'prone');
    await userEvent.type(picker.getByLabelText('Rodadas'), '3');
    await userEvent.click(picker.getByRole('button', { name: 'Aplicar Caído em Hazin Dan' }));
    await expect(args.onApply).toHaveBeenCalledWith({ condition: 'prone', roundsLeft: 3 });
  },
};

/** Exhaustion asks for its level; one already applied is updated, not added twice. */
export const AtualizarExaustao: Story = {
  name: 'Atualizar exaustão',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const picker = within(region!);
    await userEvent.selectOptions(picker.getByLabelText('Condição'), 'exhaustion');
    await userEvent.selectOptions(picker.getByLabelText('Nível'), '3');
    await userEvent.click(picker.getByRole('button', { name: 'Atualizar Exaustão em Hazin Dan' }));
    await expect(args.onApply).toHaveBeenCalledWith({ condition: 'exhaustion', level: 3 });
  },
};

export const SemCondicoes: Story = { name: 'Sem condições', args: { conditions: [] } };

/** On the sheet, outside a fight: no duration to count. */
export const NaFicha: Story = {
  name: 'Na ficha, sem duração',
  args: { durations: false },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).queryByLabelText('Rodadas')).toBeNull();
  },
};

/** All fifteen at once, with the longest labels: the chips wrap, never overflow. */
export const TodasAsCondicoes: Story = {
  name: 'Todas as condições',
  args: {
    conditions: CONDITIONS.map((condition) => (condition === 'exhaustion' ? { condition, level: 6, roundsLeft: 100 } : { condition, roundsLeft: 99 })),
  },
};

export const DuracaoInvalida: Story = {
  name: 'Duração inválida',
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const picker = within(region!);
    await userEvent.type(picker.getByLabelText('Rodadas'), '101');
    await expect(picker.getByRole('button', { name: /^Aplicar / })).toBeDisabled();
  },
};
