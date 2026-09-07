import type { Meta, StoryObj } from '@storybook/react-vite';
import { Foundations } from './Foundations';
import { expect, userEvent, within } from 'storybook/test';

const meta = {
  title: 'Foundations',
  component: Foundations,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Foundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Paleta: Story = { args: { section: 'palette' } };
export const Tipografia: Story = { args: { section: 'typography' } };
export const EspacoEForma: Story = { name: 'Espaço e forma', args: { section: 'geometry' } };
export const Estados: Story = {
  args: { section: 'states' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ids = [...canvasElement.querySelectorAll('[id]')].map((node) => node.id);
    await expect(new Set(ids).size).toBe(ids.length);
    for (const frame of canvas.getAllByRole('region', { name: /^Tema / })) {
      const theme = within(frame);
      const input = theme.getByRole('textbox', { name: 'Nome da campanha' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Ecos de Phandalin');
      await expect(input).toHaveValue('Ecos de Phandalin');
      await expect(input).toHaveAccessibleDescription('Escolha um nome que a mesa reconheça.');
      await expect(theme.getByRole('textbox', { name: 'Código de convite com erro' }))
        .toHaveAccessibleDescription('O código deve ter 6 caracteres.');
      await userEvent.click(theme.getByRole('button', { name: 'Salvar campanha' }));
      await expect(theme.getByRole('status')).toHaveTextContent('Exemplo salvo.');
      await expect(theme.getByRole('button', { name: 'Indisponível' })).toBeDisabled();
      await expect(theme.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
      await userEvent.click(theme.getByRole('button', { name: 'Cancelar' }));
      await expect(theme.getByRole('status')).toHaveTextContent('Exemplo local.');
    }
  },
};
export const Contraste: Story = { args: { section: 'accessibility' } };
