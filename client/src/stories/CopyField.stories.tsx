import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { CopyField } from '../components/CopyField';
const meta = { title: 'Componentes/CopyField', component: CopyField, args: { value: 'MESA42' } } satisfies Meta<typeof CopyField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const Copiado: Story = { args: { copy: async () => {} }, play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Código copiado.'));
  }
} };
export const Falha: Story = { args: { copy: async () => { throw new Error('Permissão negada'); } }, play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('copie manualmente'));
    await expect(canvas.getByRole('textbox')).toHaveValue('MESA42');
  }
} };
