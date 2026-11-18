import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AvatarCrop } from '@quest-fast/shared';
import { AvatarCropper } from '../components/AvatarCropper';
import { AvatarCropDialog } from '../components/AvatarCropDialog';
import { Button } from '../components/Button';

// A wide picture with the figure off to the right: the case the fixed framing got wrong.
const WIDE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">'
  + '<rect width="600" height="300" opacity=".15"/><rect y="220" width="600" height="80" opacity=".3"/>'
  + '<circle cx="470" cy="110" r="45" opacity=".7"/><rect x="420" y="160" width="100" height="120" rx="20" opacity=".55"/>'
  + '</svg>',
)}`;

function Controlled({ src, onChange }: { src: string; onChange: (crop: AvatarCrop) => void }) {
  const [crop, setCrop] = useState<AvatarCrop | null>(null);
  return <div className="max-w-80"><AvatarCropper src={src} crop={crop} onChange={(next) => { setCrop(next); onChange(next); }} /></div>;
}

const meta = {
  title: 'Componentes/AvatarCropper',
  component: Controlled,
  args: { src: WIDE, onChange: fn() },
} satisfies Meta<typeof Controlled>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

export const RetratoLargo: Story = {
  name: 'Retrato largo',
  play: async ({ canvasElement, args }) => {
    const canvas = firstTheme(canvasElement);
    const frame = canvas.getByRole('group', { name: 'Enquadramento do avatar' });
    // The default framing is the largest square, centred across.
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith({ size: 1, x: 0.25, y: 0 }));

    frame.focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}');
    const [moved] = (args.onChange as ReturnType<typeof fn>).mock.lastCall as [AvatarCrop];
    await expect(moved.x).toBeGreaterThan(0.25);

    await userEvent.keyboard('+++');
    const [zoomed] = (args.onChange as ReturnType<typeof fn>).mock.lastCall as [AvatarCrop];
    await expect(zoomed.size).toBeLessThan(1);
    const slider = canvas.getByRole<HTMLInputElement>('slider', { name: 'Zoom' });
    await expect(Number(slider.value)).toBeCloseTo(1 / zoomed.size, 2);

    // The frame never leaves the picture.
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}');
    const [edge] = (args.onChange as ReturnType<typeof fn>).mock.lastCall as [AvatarCrop];
    await expect(edge.x * 600 + edge.size * 300).toBeCloseTo(600, 5);
  },
};

export const RetratoQuadrado: Story = { name: 'Retrato quadrado', args: { src: '/portraits/elara-example.png' } };

function DialogExample({ onConfirm }: { onConfirm: (crop: AvatarCrop) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  return <>
    <Button onClick={() => setSrc(WIDE)}>Enviar avatar</Button>
    <AvatarCropDialog src={src} onCancel={() => setSrc(null)} onConfirm={(crop) => { setSrc(null); onConfirm(crop); }} />
  </>;
}

export const NoDialogo: StoryObj<typeof DialogExample> = {
  name: 'No diálogo',
  render: (args) => <DialogExample {...args} />,
  args: { onConfirm: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = firstTheme(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Enviar avatar' }));
    const dialog = await canvas.findByRole('dialog', { name: 'Enquadrar avatar' });
    const confirm = within(dialog).getByRole('button', { name: 'Usar enquadramento' });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);
    await expect(args.onConfirm).toHaveBeenCalledWith({ size: 1, x: 0.25, y: 0 });
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument());
  },
};
