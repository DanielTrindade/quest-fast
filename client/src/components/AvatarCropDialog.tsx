import { useState } from 'react';
import type { AvatarCrop } from '@quest-fast/shared';
import { AvatarCropper } from './AvatarCropper';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { dialogActions } from './layout-styles';

/** Opens with an image the player picked; confirming hands back the framing. */
export function AvatarCropDialog({ src, initialCrop = null, onConfirm, onCancel }: {
  /** The image to frame; the dialog is open while there is one. */
  src: string | null;
  initialCrop?: AvatarCrop | null;
  onConfirm: (crop: AvatarCrop) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={src !== null}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="Enquadrar avatar"
      description="O que ficar dentro do círculo aparece na ficha e no token."
    >
      {/* Keyed by the image: a new pick starts from its own default framing. */}
      {src && <CropBody key={src} src={src} initialCrop={initialCrop} onConfirm={onConfirm} onCancel={onCancel} />}
    </Dialog>
  );
}

function CropBody({ src, initialCrop, onConfirm, onCancel }: {
  src: string;
  initialCrop: AvatarCrop | null;
  onConfirm: (crop: AvatarCrop) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState(initialCrop);
  return (
    <>
      <AvatarCropper src={src} crop={crop} onChange={setCrop} />
      <div className={dialogActions}>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="button" disabled={!crop} onClick={() => crop && onConfirm(crop)}>Usar enquadramento</Button>
      </div>
    </>
  );
}
