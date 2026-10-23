import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Statblock, StatblockInput } from '@quest-fast/shared';
import { Dialog } from '../../components/Dialog';
import { StatblockForm, type StatblockFormHandle } from '../../components/StatblockForm';
import { ApiError, api } from '../../lib/api';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

/**
 * Dialog shell and saving for the bestiary editor. The form owns the fields,
 * the validation and the discard guard; Radix close attempts go through it.
 */
export function StatblockFormDialog({ campaignId, statblock, onClose, onSaved }: {
  campaignId: string;
  statblock: Statblock | null;
  onClose: () => void;
  onSaved: (saved: Statblock, created: boolean) => void;
}) {
  const formRef = useRef<StatblockFormHandle>(null);
  const save = useMutation({
    mutationFn: (input: StatblockInput) =>
      statblock ? api.updateStatblock(campaignId, statblock.id, input) : api.createStatblock(campaignId, input),
    onSuccess: (response) => onSaved(response.statblock, statblock === null),
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) formRef.current?.requestClose();
      }}
      className="qf-dialog--wide"
      title={statblock ? `Editar ${statblock.name}` : 'Nova criatura'}
      description="Cadastre uma vez e use quantas cópias quiser nos encontros. Só você vê o bestiário."
    >
      <StatblockForm
        ref={formRef}
        statblock={statblock}
        pending={save.isPending}
        submitError={save.isError ? errorMessage(save.error) : undefined}
        onSubmit={(input) => save.mutate(input)}
        onRequestClose={onClose}
      />
    </Dialog>
  );
}
