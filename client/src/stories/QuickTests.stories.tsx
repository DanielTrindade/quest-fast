import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { QuickTests } from '../components/QuickTests';
import { hazinDan } from './fixtures/characters';
import { worstCase } from './fixtures/my-characters';

const meta = {
  title: 'Componentes/QuickTests',
  component: QuickTests,
  args: { sheet: hazinDan, onRoll: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 360 }}><Story /></div>],
} satisfies Meta<typeof QuickTests>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** A test by default; "Salvaguarda" turns the same six into saves, with the proficient ones marked. */
export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Teste de Força (+5)' }));
    await expect(args.onRoll).toHaveBeenLastCalledWith({ kind: 'check', ability: 'strength', mode: 'normal' });
    await userEvent.click(panel.getByRole('radio', { name: 'Salvaguarda' }));
    await userEvent.click(panel.getByRole('radio', { name: 'Vantagem' }));
    await userEvent.click(panel.getByRole('button', { name: 'Salvaguarda de Constituição (+6, proficiente)' }));
    await expect(args.onRoll).toHaveBeenLastCalledWith({ kind: 'save', ability: 'constitution', mode: 'advantage' });
    await userEvent.click(panel.getByRole('button', { name: /^Teste de Atletismo/ }));
    await expect(args.onRoll).toHaveBeenLastCalledWith({ kind: 'skill', skill: 'athletics', mode: 'advantage' });
  },
};

export const Rolando: Story = { args: { pending: true } };

/** No trained skill: all eighteen fold under "Perícias". */
export const SemPericiasTreinadas: Story = {
  name: 'Sem perícias treinadas',
  args: { sheet: { ...hazinDan, skills: [], expertise: [] } },
};

export const PiorCaso: Story = { name: 'Pior caso', args: { sheet: worstCase } };
