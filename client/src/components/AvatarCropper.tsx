import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  AVATAR_CROP_MAX_ZOOM,
  clampAvatarCrop,
  defaultAvatarCrop,
  zoomAvatarCrop,
  type AvatarCrop,
} from '@quest-fast/shared';
import { Skeleton } from './Skeleton';

type Size = { width: number; height: number };

const KEY_PAN: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/**
 * Frames an avatar: the image moves under a fixed circle, and what stays
 * inside it is what the sheet and the token show. Drag, the wheel, the zoom
 * slider and the keyboard (arrows to move, + and − to zoom) all edit the crop.
 */
export function AvatarCropper({ src, crop, onChange }: {
  src: string;
  /** Null until the image loads; the cropper then proposes the default framing. */
  crop: AvatarCrop | null;
  onChange: (crop: AvatarCrop) => void;
}) {
  const hintId = useId();
  const zoomId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  // The browser may refuse what the server would too (a truncated file, a HEIC renamed to .jpg).
  const [broken, setBroken] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; start: AvatarCrop } | null>(null);

  const ready = size && crop;

  // The step moves the frame by a share of its own side, so it feels the same at any zoom.
  const pan = (from: AvatarCrop, dx: number, dy: number) => {
    if (!size) return from;
    const side = from.size * Math.min(size.width, size.height);
    return clampAvatarCrop({ ...from, x: from.x + (dx * side) / size.width, y: from.y + (dy * side) / size.height }, size.width, size.height);
  };

  const zoomTo = (zoom: number) => {
    if (!size || !crop) return;
    const next = Math.min(Math.max(zoom, 1), AVATAR_CROP_MAX_ZOOM);
    onChange(zoomAvatarCrop(crop, 1 / next, size.width, size.height));
  };

  // React's wheel listener is passive: the dialog would scroll along with the zoom.
  const onWheel = useEffectEvent((event: WheelEvent) => {
    if (!crop) return;
    event.preventDefault();
    zoomTo((1 / crop.size) * Math.exp(-event.deltaY * 0.002));
  });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // A second finger would make the image jump to it.
    if (!crop || drag.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: crop };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const side = event.currentTarget.getBoundingClientRect().width;
    // Dragging the image right shows more of its left: the frame moves the other way.
    onChange(pan(current.start, -(event.clientX - current.x) / side, -(event.clientY - current.y) / side));
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!crop) return;
    const step = event.shiftKey ? 0.1 : 0.02;
    const direction = KEY_PAN[event.key];
    if (direction) {
      event.preventDefault();
      onChange(pan(crop, direction[0] * step, direction[1] * step));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(1 / crop.size + 0.1);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomTo(1 / crop.size - 0.1);
    }
  };

  // Drawn as the frame's own background, sized and placed in percentages of
  // the square: no measuring, and no overflowing image for axe to trip on.
  const background = ready ? backgroundFor(src, crop, size) : undefined;
  const zoom = crop ? 1 / crop.size : 1;

  return (
    <div className="grid justify-items-center gap-4">
      <div
        ref={viewport}
        role="group"
        aria-label="Enquadramento do avatar"
        aria-describedby={hintId}
        tabIndex={0}
        className="relative aspect-square w-full max-w-72 cursor-grab touch-none overflow-hidden rounded-control bg-no-repeat bg-muted select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={background}
      >
        {broken ? (
          <p role="alert" className="absolute inset-0 grid place-items-center p-4 text-center text-small text-danger-text">
            Não foi possível abrir esta imagem. Escolha um arquivo PNG, JPEG, WebP ou GIF.
          </p>
        ) : !ready && <span className="absolute inset-0 grid p-2"><Skeleton shape="avatar" label="Carregando imagem" /></span>}
        {/* Never shown: it loads the file and reports its size. */}
        <img
          src={src}
          alt=""
          hidden
          onError={() => setBroken(true)}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            setSize({ width, height });
            onChange(crop ? clampAvatarCrop(crop, width, height) : defaultAvatarCrop(width, height));
          }}
        />
        {ready && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_var(--color-scrim)] ring-2 ring-accent-fg" />
        )}
      </div>
      <p id={hintId} className="text-center text-small text-text-secondary">
        Arraste a imagem para posicionar. No teclado, use as setas para mover e + ou − para o zoom.
      </p>
      <div className="grid w-full max-w-72 gap-1">
        <label htmlFor={zoomId} className="text-small font-medium text-foreground">Zoom</label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={AVATAR_CROP_MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={!ready}
          aria-valuetext={`${zoom.toFixed(1)}×`}
          className="h-11 w-full min-w-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
          onChange={(event) => zoomTo(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

// A percentage in `background-position` aligns that point of the image with
// the same point of the box, so the offset is turned into that share.
function backgroundFor(src: string, crop: AvatarCrop, size: Size) {
  const scale = 1 / (crop.size * Math.min(size.width, size.height));
  const width = size.width * scale;
  const height = size.height * scale;
  const position = (offset: number, extent: number) => (extent > 1 + 1e-6 ? (offset / (extent - 1)) * 100 : 0);
  return {
    backgroundImage: `url(${JSON.stringify(src)})`,
    backgroundSize: `${width * 100}% ${height * 100}%`,
    backgroundPosition: `${position(crop.x * width, width)}% ${position(crop.y * height, height)}%`,
  };
}
