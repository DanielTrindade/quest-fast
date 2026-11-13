import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, userEvent, within } from 'storybook/test';
import { SceneForm } from '../components/SceneForm';
import { syntheticMapUrl } from './fixtures/maps';

const meta = {
  title: 'Componentes/SceneForm',
  component: SceneForm,
  args: { onSubmit: fn(), onCancel: fn() },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof SceneForm>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

/** A real PNG from the synthetic map, small enough to pick in a test. */
async function mapFile(width: number, height: number, type = 'image/png') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const image = new Image();
  image.src = syntheticMapUrl();
  await image.decode();
  canvas.getContext('2d')!.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((result) => resolve(result!), type));
  return new File([blob], 'salao.png', { type });
}

export const Criar: Story = {
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    await userEvent.click(form.getByRole('button', { name: 'Criar cena' }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(form.getByText(/Dê um nome à cena/)).toBeVisible();
    await expect(form.getByText('Escolha a imagem do mapa.')).toBeVisible();

    await userEvent.type(form.getByLabelText(/Nome da cena/), 'Salão em ruínas');
    await userEvent.upload(form.getByLabelText(/Escolher imagem/), await mapFile(30, 20));
    await expect(await form.findByText(/de 64 a 8192 pixels/)).toBeVisible();

    const file = await mapFile(600, 400);
    await userEvent.upload(form.getByLabelText(/Escolher imagem/), file);
    await expect(await form.findByText(/600 × 400/)).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Criar cena' }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'Salão em ruínas', file: expect.any(File) });
  },
};

export const Editar: Story = {
  render: (args) => <SceneForm {...args} scene={{ name: 'Salão em ruínas', mapUrl: syntheticMapUrl() }} />,
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    const name = form.getByLabelText(/Nome da cena/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Salão alagado');
    await userEvent.click(form.getByRole('button', { name: 'Salvar cena' }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'Salão alagado', file: null });
  },
};

/** Only the name changed: no map goes up, but the form still waits for the save. */
export const SalvandoNome: Story = {
  name: 'Salvando o nome',
  args: { saving: true },
  render: (args) => <SceneForm {...args} scene={{ name: 'Salão em ruínas', mapUrl: syntheticMapUrl() }} />,
  play: async ({ canvasElement, args }) => {
    const form = firstTheme(canvasElement);
    await expect(form.getByLabelText(/Nome da cena/)).toBeDisabled();
    await expect(form.getByRole('button', { name: 'Salvar cena' })).toBeDisabled();
    await expect(form.queryByRole('progressbar')).toBeNull();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const Enviando: Story = {
  args: { upload: { phase: 'uploading', percent: 42 } },
  render: (args) => <SceneForm {...args} scene={{ name: 'Estrada de Triboar', mapUrl: syntheticMapUrl() }} />,
};

export const Processando: Story = {
  name: 'Preparando no servidor',
  args: { upload: { phase: 'processing' } },
  render: (args) => <SceneForm {...args} scene={{ name: 'Estrada de Triboar', mapUrl: syntheticMapUrl() }} />,
};

export const ErroDoServidor: Story = {
  name: 'Erro do servidor',
  args: { serverError: 'O mapa deve ter até 25 MB.' },
};

export const ArquivoPesado: Story = {
  name: 'Arquivo acima de 25 MB',
  play: async ({ canvasElement }) => {
    const form = firstTheme(canvasElement);
    // Refused by its weight alone: the image is never decoded.
    const decode = spyOn(window, 'createImageBitmap');
    try {
      const heavy = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'mapa-enorme.png', { type: 'image/png' });
      await userEvent.upload(form.getByLabelText(/Escolher imagem/), heavy);
      await expect(await form.findByText('O mapa deve ter até 25 MB.')).toBeVisible();
      await expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  },
};
