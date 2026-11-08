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

function themeRegions(canvasElement: HTMLElement) {
  return within(canvasElement).getAllByRole('region', { name: /^Tema / }).map(region => within(region));
}

export const CliqueAbreDiscord: Story = {
  play: async ({ canvasElement }) => {
    for (const canvas of themeRegions(canvasElement)) {
      await userEvent.click(canvas.getByRole('link', { name: 'Entrar com o Discord' }));
      const link = canvas.getByRole('link', { name: 'Abrindo o Discord…' });
      await expect(link).toHaveAttribute('aria-busy', 'true');
      await expect(link).toHaveAttribute('aria-disabled', 'true');
    }
  },
};

export const AbrirEmOutraAba: Story = {
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    // Keeps the story frame from following the link; the component must not depend on it.
    const stay = (event: Event) => event.preventDefault();
    window.addEventListener('click', stay);
    try {
      for (const canvas of themeRegions(canvasElement)) {
        const link = canvas.getByRole('link', { name: 'Entrar com o Discord' });
        for (const key of ['Control', 'Meta', 'Shift']) {
          await user.keyboard(`{${key}>}`);
          await user.click(link);
          await user.keyboard(`{/${key}}`);
          await expect(canvas.getByRole('link', { name: 'Entrar com o Discord' })).not.toHaveAttribute('aria-busy');
        }
        await user.click(link);
        await expect(canvas.getByRole('link', { name: 'Abrindo o Discord…' })).toHaveAttribute('aria-busy', 'true');
      }
    } finally {
      window.removeEventListener('click', stay);
    }
  },
};
