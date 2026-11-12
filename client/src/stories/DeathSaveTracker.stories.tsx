import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DeathSaveTracker } from '../components/DeathSaveTracker';

const meta = {
  title: 'Componentes/DeathSaveTracker',
  component: DeathSaveTracker,
  args: { name: 'Hazin Dan', deathSaves: { successes: 1, failures: 2 }, canRoll: true, onRoll: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof DeathSaveTracker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NaVez: Story = {
  name: 'Morrendo, na vez',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText('Morrendo')).toBeVisible();
    await userEvent.click(within(region!).getByRole('button', { name: 'Teste contra a morte de Hazin Dan' }));
    await expect(args.onRoll).toHaveBeenLastCalledWith('normal');
  },
};

/** A feature or a spell grants advantage: the roll goes with it. */
export const ComVantagem: Story = {
  name: 'Morrendo, com vantagem',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const tracker = within(region!);
    await userEvent.click(tracker.getByRole('radio', { name: 'Vantagem' }));
    await userEvent.click(tracker.getByRole('button', { name: 'Teste contra a morte de Hazin Dan' }));
    await expect(args.onRoll).toHaveBeenLastCalledWith('advantage');
  },
};

export const ForaDaVez: Story = { name: 'Morrendo, fora da vez', args: { canRoll: false } };

export const Estavel: Story = {
  name: 'Estável',
  args: { deathSaves: { successes: 3, failures: 1 } },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText('Estável')).toBeVisible();
    await expect(within(region!).queryByRole('button')).toBeNull();
  },
};

export const Morto: Story = {
  args: { deathSaves: { successes: 2, failures: 3 } },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText('Morto')).toBeVisible();
    await expect(within(region!).queryByRole('button')).toBeNull();
  },
};
