import { Warning } from '@phosphor-icons/react';
import { Button } from './Button';

/**
 * The footer of an editor in a dialog, pinned to the bottom so saving stays
 * reachable while the form scrolls. With unsaved changes, closing turns into
 * a two-step choice: keep editing or discard.
 */
export function FormFooter({
  error, confirmingDiscard, onKeepEditing, onDiscard, onCancel, submitLabel, pending = false, busyMessage,
}: {
  error?: string;
  confirmingDiscard: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  submitLabel: string;
  pending?: boolean;
  /** Work that must finish before saving, such as reading an imported PDF: shown, and the submit stays off. */
  busyMessage?: string;
}) {
  return (
    <div data-slot="form-footer" className="sticky bottom-[calc(var(--qf-dialog-pad)*-1)] z-1 -mx-(--qf-dialog-pad) mt-4 -mb-(--qf-dialog-pad) grid gap-2 border-t border-border bg-popover px-(--qf-dialog-pad) py-4">
      {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
      {confirmingDiscard ? (
        <div role="group" aria-label="Alterações não salvas">
          <p className="m-0 flex items-center gap-2 text-small text-danger-text">
            <Warning size={18} weight="fill" aria-hidden="true" />
            Há alterações que ainda não foram salvas.
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onKeepEditing}>Continuar editando</Button>
            <Button variant="danger" type="button" onClick={onDiscard}>Descartar alterações</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {busyMessage && <p className="m-0 mr-auto self-center text-small text-text-secondary">{busyMessage}</p>}
          <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={Boolean(busyMessage)} loading={pending}>{submitLabel}</Button>
        </div>
      )}
    </div>
  );
}
