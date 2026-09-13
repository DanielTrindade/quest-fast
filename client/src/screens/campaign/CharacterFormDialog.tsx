import { useRef } from 'react';
import type { CharacterSheet } from '@quest-fast/shared';
import { Dialog } from '../../components/Dialog';
import { CharacterForm, type CharacterFormHandle } from '../../components/CharacterForm';

/**
 * Dialog shell for the sheet editor. The form owns the field state, the
 * discard guard and the validation; this file only hosts it in a modal and
 * funnels Radix close attempts (Escape, click outside, close button) into
 * the form's `requestClose`, which decides between discarding and staying.
 */
export function CharacterFormDialog({
  campaignId,
  character,
  open,
  onOpenChange,
  onSaved,
}: {
  campaignId: string;
  character: CharacterSheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const formRef = useRef<CharacterFormHandle>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else formRef.current?.requestClose();
      }}
      className="qf-dialog--wide"
      title={character ? `Editar ${character.name}` : 'Novo personagem'}
      description="A ficha é sua: só você edita, e a mesa toda vê. Rolagens usam estes valores na hora."
    >
      <CharacterForm
        ref={formRef}
        campaignId={campaignId}
        character={character}
        onSaved={onSaved}
        onRequestClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}