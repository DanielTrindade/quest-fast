import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImageSquare, Warning } from '@phosphor-icons/react';
import { MAP_LIMITS as M, SCENE_LIMITS as S, isMapType } from '@quest-fast/shared';
import { Button } from './Button';
import { Field } from './Field';
import { fileButton, formError } from './form-styles';

export type SceneUpload =
  | { phase: 'uploading'; percent: number }
  /** The file arrived; the server is reducing and converting it. */
  | { phase: 'processing' };

type Picked = { file: File; url: string; width: number; height: number };

const MEGABYTE = 1024 * 1024;
const LIMITS_HINT = `JPEG, PNG ou WebP, até ${M.maxBytes / MEGABYTE} MB e ${M.maxInputSide} pixels de lado. Acima de ${M.maxOutputSide} pixels, o mapa é reduzido.`;

/** The image's pixels, read by decoding it; null when it does not decode. */
async function readSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

const NOT_A_MAP = 'O arquivo não é uma imagem válida. Use JPEG, PNG ou WebP.';

/**
 * The same bounds the server applies, checked before sending 25 MB for
 * nothing. Type and weight first: they cost nothing, while reading the size
 * decodes the whole image, which a phone should not do for a file refused anyway.
 */
function fileProblem(file: File): string | null {
  if (!isMapType(file.type)) return NOT_A_MAP;
  if (file.size > M.maxBytes) return `O mapa deve ter até ${M.maxBytes / MEGABYTE} MB.`;
  return null;
}

function sizeProblem(size: { width: number; height: number } | null): string | null {
  if (!size) return NOT_A_MAP;
  const smallest = Math.min(size.width, size.height);
  const largest = Math.max(size.width, size.height);
  if (smallest < M.minSide || largest > M.maxInputSide) {
    return `O mapa deve ter de ${M.minSide} a ${M.maxInputSide} pixels de lado.`;
  }
  return null;
}

/** The picked file, or the scene's current map, as a thumbnail. */
function MapPreview({ src }: { src?: string }) {
  return (
    <div className="grid aspect-[3/2] w-40 flex-none place-items-center overflow-hidden rounded-control border border-border bg-surface-secret text-text-muted">
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <ImageSquare size={32} weight="duotone" aria-hidden="true" />}
    </div>
  );
}

function UploadProgress({ upload }: { upload: SceneUpload }) {
  const uploading = upload.phase === 'uploading';
  return (
    <div className="grid gap-2" aria-live="polite">
      <p className="m-0 text-small text-text-secondary">
        {uploading ? `Enviando o mapa… ${upload.percent}%` : 'Preparando o mapa no servidor…'}
      </p>
      <div role="progressbar" aria-label="Envio do mapa" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={uploading ? upload.percent : undefined}
        aria-valuetext={uploading ? `${upload.percent}% enviado` : 'Preparando o mapa'}
        className="h-2 overflow-hidden rounded-full border border-border bg-surface-secret">
        <div data-phase={upload.phase}
          className="h-full rounded-full bg-primary transition-[width] duration-(--duration-quick) ease-settle data-[phase=processing]:w-full data-[phase=processing]:opacity-60 motion-safe:data-[phase=processing]:animate-pulse"
          style={uploading ? { width: `${upload.percent}%` } : undefined} />
      </div>
    </div>
  );
}

/**
 * Creates a scene (name and map) or edits one (name, and optionally a new
 * map). Checks the map's type, weight and size before sending, shows the
 * upload's progress and then the server's processing, and the server's
 * refusal when there is one. Presentational: the screen sends the request.
 */
export function SceneForm({ scene, upload, saving = false, serverError, onSubmit, onCancel }: {
  /** The scene being edited; absent to create one. */
  scene?: { name: string; mapUrl: string };
  upload?: SceneUpload;
  /** The save is on its way, with or without a map: the form waits for it. */
  saving?: boolean;
  serverError?: string;
  /** `file` is null when editing without swapping the map. */
  onSubmit: (input: { name: string; file: File | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(scene?.name ?? '');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [mapError, setMapError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const busy = saving || upload !== undefined;
  const pickedUrl = picked?.url;

  // The preview's object URL lives as long as it is the picked file's.
  useEffect(() => () => {
    if (pickedUrl) URL.revokeObjectURL(pickedUrl);
  }, [pickedUrl]);

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing lets the same file be picked again after a fix.
    event.target.value = '';
    if (!file) return;
    const refused = fileProblem(file);
    if (refused) {
      setMapError(refused);
      return;
    }
    const size = await readSize(file);
    const problem = sizeProblem(size);
    setMapError(problem ?? undefined);
    if (!problem && size) setPicked({ file, url: URL.createObjectURL(file), ...size });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = name.trim();
    const nextNameError = !clean || clean.length > S.name ? `Dê um nome à cena, com até ${S.name} caracteres.` : undefined;
    const nextMapError = !scene && !picked ? 'Escolha a imagem do mapa.' : mapError;
    setNameError(nextNameError);
    setMapError(nextMapError);
    if (!nextNameError && !nextMapError) {
      onSubmit({ name: clean, file: picked?.file ?? null });
      return;
    }
    const form = event.currentTarget;
    // After the render that marks the fields, so the first invalid one is found.
    requestAnimationFrame(() => (nextNameError
      ? form.querySelector<HTMLElement>('input[aria-invalid="true"]')
      : fileRef.current)?.focus());
  };

  return (
    <form className="grid min-w-0 gap-5" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <Field label="Nome da cena" placeholder="Estrada de Triboar" maxLength={S.name} required
        value={name} error={nameError} disabled={busy} onChange={(event) => setName(event.target.value)} />

      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0" disabled={busy}>
        <legend className="mb-2 p-0 text-small font-medium">Mapa</legend>
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <MapPreview src={pickedUrl ?? scene?.mapUrl} />
          <div className="grid min-w-0 flex-[1_1_12rem] justify-items-start gap-2">
            <label className={fileButton} aria-disabled={busy || undefined}>
              <ImageSquare size={18} aria-hidden="true" />
              {picked || scene ? 'Trocar imagem' : 'Escolher imagem'}
              <input ref={fileRef} type="file" accept={M.types.join(',')} onChange={pick}
                aria-describedby={mapError ? `${hintId} ${errorId}` : hintId} aria-invalid={mapError ? true : undefined} />
            </label>
            {picked && (
              <p className="m-0 text-small text-text-secondary [overflow-wrap:anywhere]">
                {picked.file.name}, <span className="font-mono tabular-nums">{picked.width} × {picked.height}</span> pixels
              </p>
            )}
            <p id={hintId} className="m-0 text-small text-text-muted">{LIMITS_HINT}</p>
            {mapError && <p id={errorId} className={formError}>{mapError}</p>}
          </div>
        </div>
      </fieldset>

      {upload && <UploadProgress upload={upload} />}

      {serverError && (
        <p role="alert" className="m-0 flex items-start gap-2 text-small text-danger-text [&>svg]:mt-px [&>svg]:flex-none">
          <Warning size={18} weight="fill" aria-hidden="true" />{serverError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={busy}>{scene ? 'Salvar cena' : 'Criar cena'}</Button>
      </div>
    </form>
  );
}
