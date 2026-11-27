import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AREA_LIMITS } from '@quest-fast/shared';
import { AreaToolbar } from '../components/AreaToolbar';
import { DEFAULT_AREA_DRAFT, type AreaDraft } from '../lib/area-tool';

type Props = Parameters<typeof AreaToolbar>[0];

/** The toolbar keeping its own draft, as the screen will, so the controls can be driven. */
function Stateful(props: Props) {
  const [draft, setDraft] = useState<AreaDraft>(props.draft);
  const [drawing, setDrawing] = useState(props.drawing);
  return (
    <AreaToolbar {...props} draft={draft} drawing={drawing}
      onDraftChange={(next) => { setDraft(next); props.onDraftChange(next); }}
      onDrawingChange={(next) => { setDrawing(next); props.onDrawingChange(next); }} />
  );
}

const meta = {
  title: 'Componentes/AreaToolbar',
  component: AreaToolbar,
  args: {
    draft: DEFAULT_AREA_DRAFT,
    onDraftChange: fn(),
    drawing: false,
    onDrawingChange: fn(),
    master: false,
  },
  render: (args) => <Stateful {...args} />,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof AreaToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Referencia: Story = {
  name: 'Referência',
  play: async ({ canvasElement, args }) => {
    const bar = firstTheme(canvasElement);
    await expect(bar.getByRole('radio', { name: 'Referência' })).toBeChecked();
    await expect(bar.queryByLabelText('Nome da área')).not.toBeInTheDocument();
    await userEvent.click(bar.getByRole('radio', { name: 'Cone' }));
    await expect(bar.getByLabelText('Comprimento')).toBeInTheDocument();
    await userEvent.click(bar.getByRole('button', { name: 'Desenhar no mapa' }));
    await expect(args.onDrawingChange).toHaveBeenLastCalledWith(true);
    await expect(bar.getByText('Pressione onde a área começa e arraste para apontá-la.')).toBeInTheDocument();
  },
};

export const FicaNaCena: Story = {
  name: 'Fica na cena',
  args: { draft: { ...DEFAULT_AREA_DRAFT, mode: 'persistent' } },
  play: async ({ canvasElement }) => {
    const bar = firstTheme(canvasElement);
    // Without a name nothing goes on the scene.
    await expect(bar.getByRole('button', { name: 'Desenhar no mapa' })).toBeDisabled();
    await userEvent.type(bar.getByLabelText('Nome da área'), 'Teia');
    await userEvent.click(bar.getByRole('radio', { name: 'Verde' }));
    await expect(bar.getByRole('button', { name: 'Desenhar no mapa' })).toBeEnabled();
    await expect(bar.queryByLabelText('Oculta para a mesa')).not.toBeInTheDocument();
  },
};

export const Linha: Story = {
  args: { draft: { ...DEFAULT_AREA_DRAFT, shape: 'line', size: 18, width: 3 } },
  play: async ({ canvasElement }) => {
    await expect(firstTheme(canvasElement).getByLabelText('Largura')).toHaveValue('3');
  },
};

export const MestreOculta: Story = {
  name: 'Mestre: área oculta',
  args: { master: true, draft: { ...DEFAULT_AREA_DRAFT, mode: 'persistent', name: 'Glifo de Proteção', hidden: true, tint: 'violet' } },
  play: async ({ canvasElement }) => {
    await expect(firstTheme(canvasElement).getByLabelText('Oculta para a mesa')).toBeChecked();
  },
};

export const SeguirToken: Story = {
  name: 'Seguir o token selecionado',
  args: { anchor: 'Kaelen', onAnchor: fn(), draft: { ...DEFAULT_AREA_DRAFT, mode: 'persistent', name: 'Espírito Guardião', size: 4.5, tint: 'emerald' } },
  play: async ({ canvasElement, args }) => {
    const bar = firstTheme(canvasElement);
    await userEvent.click(bar.getByRole('button', { name: 'Seguir Kaelen' }));
    await expect(args.onAnchor).toHaveBeenCalled();
    // A cone points somewhere: it does not follow a token.
    await userEvent.click(bar.getByRole('radio', { name: 'Cone' }));
    await expect(bar.queryByRole('button', { name: 'Seguir Kaelen' })).not.toBeInTheDocument();
  },
};

export const Desenhando: Story = {
  args: { drawing: true },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(firstTheme(canvasElement).getByRole('button', { name: 'Voltar a mover o mapa' }));
    await expect(args.onDrawingChange).toHaveBeenLastCalledWith(false);
  },
};

export const PiorCaso: Story = {
  name: 'Pior caso',
  args: {
    master: true,
    anchor: 'Bartholomew Pedregulho-Ferroforjado de Neverwinter',
    onAnchor: fn(),
    draft: { ...DEFAULT_AREA_DRAFT, mode: 'persistent', name: 'M'.repeat(AREA_LIMITS.name), shape: 'cylinder', size: 36 },
    error: 'A cena já tem o máximo de 50 áreas.',
  },
};
