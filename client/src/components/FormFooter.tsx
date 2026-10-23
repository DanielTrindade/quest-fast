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
    <div className="sheet-form__footer">
      {error && <p role="alert" className="text-small text-danger-text">{error}</p>}
      {confirmingDiscard ? (
        <div role="group" aria-label="Alterações não salvas">
          <p className="sheet-form__discard">
            <Warning size={18} weight="fill" aria-hidden="true" />
            Há alterações que ainda não foram salvas.
          </p>
          <div className="qf-dialog__actions">
            <Button variant="secondary" type="button" onClick={onKeepEditing}>Continuar editando</Button>
            <Button variant="danger" type="button" onClick={onDiscard}>Descartar alterações</Button>
          </div>
        </div>
      ) : (
        <div className="qf-dialog__actions">
          {busyMessage && <p className="sheet-form__importing">{busyMessage}</p>}
          <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={Boolean(busyMessage)} loading={pending}>{submitLabel}</Button>
        </div>
      )}
    </div>
  );
}
