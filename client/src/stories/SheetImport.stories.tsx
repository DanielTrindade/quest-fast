import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { SheetImport } from '../components/SheetImport';
import '../styles/campaign.css';

const meta = {
  title: 'Componentes/SheetImport',
  component: SheetImport,
  args: { status: { kind: 'idle' }, onPick: fn() },
} satisfies Meta<typeof SheetImport>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = { name: 'Padrão' };

export const Lendo: Story = { args: { status: { kind: 'reading' } } };

export const Importada: Story = {
  args: { status: { kind: 'done', fileName: 'Ficha_Hazin_Dan.pdf', warnings: [] } },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await expect(within(region).getByText('Ficha importada. Revise os dados antes de criar.')).toBeVisible();
    }
  },
};

export const ComAvisos: Story = {
  name: 'Importada com avisos',
  args: {
    status: {
      kind: 'done',
      fileName: 'Ficha_Aziel_Brasar.pdf',
      warnings: [
        'Sem círculo na ficha, ficaram no 1º: palavrasCurativas, CurarFerimentos.',
        'Itens com mais de 200 caracteres foram cortados: "Força na Fúria".',
      ],
    },
  },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      // A partial import must not read as done.
      await expect(within(region).getByText(/Ficha importada com pontos para revisar/)).toBeVisible();
      await expect(within(region).queryByText('Ficha importada. Revise os dados antes de criar.')).toBeNull();
      await expect(within(region).getByRole('list', { name: 'Pontos para revisar' }).children).toHaveLength(2);
    }
  },
};

export const Erro: Story = {
  args: { status: { kind: 'error', message: 'Este PDF não é a ficha oficial de D&D 2024 em português.' } },
};
