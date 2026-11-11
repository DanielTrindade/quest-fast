import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

function Sample({ broken = false }: { broken?: boolean }) {
  if (broken) throw new Error('Deliberate render failure.');
  return <p className="p-4 text-text-primary">Controle do verificador</p>;
}

// These stories fail on purpose: `npm run test:design` only passes while it
// still catches them. Hidden from the sidebar and from the docs.
const meta = {
  title: 'Interno/Controles do verificador',
  component: Sample,
  tags: ['!dev', '!autodocs'],
} satisfies Meta<typeof Sample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlayFails: Story = {
  tags: ['expects-play-failure'],
  play: () => {
    throw new Error('Deliberate play failure.');
  },
};

export const PlayFailsAfterAwait: Story = {
  tags: ['expects-play-failure'],
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(1).toBe(2);
  },
};

export const RenderFails: Story = {
  tags: ['expects-render-failure'],
  args: { broken: true },
};
