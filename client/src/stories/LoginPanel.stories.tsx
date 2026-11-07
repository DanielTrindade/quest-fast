import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { LoginPanel } from '../components/LoginPanel';

function Example({ failed = false, startLeaving = false }: { failed?: boolean; startLeaving?: boolean }) {
  const [leaving, setLeaving] = useState(startLeaving);
  return <LoginPanel href="#discord" failed={failed} leaving={leaving} onLeave={() => setLeaving(true)} />;
}

const meta = {
  title: 'Componentes/LoginPanel',
  component: Example,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {};

export const Falhou: Story = { args: { failed: true } };

export const AbrindoDiscord: Story = { args: { startLeaving: true } };

export const CliqueAbreDiscord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Entrar com o Discord' }));
    const link = canvas.getByRole('link', { name: 'Abrindo o Discord…' });
    await expect(link).toHaveAttribute('aria-busy', 'true');
    await expect(link).toHaveAttribute('aria-disabled', 'true');
  },
};
