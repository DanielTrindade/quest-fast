import { useState } from 'react';
import { PencilSimple, Trash, Warning } from '@phosphor-icons/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Statblock } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Skeleton } from '../../components/Skeleton';
import { StatblockCard } from '../../components/StatblockCard';
import { ApiError, api } from '../../lib/api';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

/**
 * One bestiary entry for the master: the statblock, editing and deletion.
 * The deletion asks inside the same dialog, like the character sheet.
 */
export function StatblockDialog({ campaignId, statblockId, onClose, onEdit, onDeleted }: {
  campaignId: string;
  statblockId: string;
  onClose: () => void;
  onEdit: (statblock: Statblock) => void;
  onDeleted: (name: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const entry = useQuery({
    queryKey: ['statblock', campaignId, statblockId],
    queryFn: () => api.statblock(campaignId, statblockId),
  });
  const statblock = entry.data?.statblock;

  const remove = useMutation({
    mutationFn: () => api.deleteStatblock(campaignId, statblockId),
    onSuccess: () => onDeleted(statblock?.name ?? 'Criatura'),
  });

  return (
    <Dialog
      className="qf-dialog--sheet"
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={statblock?.name ?? 'Criatura'}
      description="Só você vê o bestiário. Os encontros copiam estes valores, então editar aqui não muda um combate em andamento."
    >
      {entry.isPending && (
        <div className="qf-stack" aria-busy="true" aria-label="Carregando criatura">
          <Skeleton shape="line" width="60%" />
          <Skeleton shape="panel" />
        </div>
      )}

      {entry.isError && (
        <div className="qf-stack">
          <p role="alert" className="text-body text-danger-text">{errorMessage(entry.error)}</p>
          <div>
            <Button variant="secondary" onClick={() => entry.refetch()}>Tentar novamente</Button>
          </div>
        </div>
      )}

      {statblock && (
        <div className="qf-stack">
          <StatblockCard
            statblock={statblock}
            actions={!confirmingDelete && (
              <>
                <Button variant="secondary" onClick={() => onEdit(statblock)}>
                  <PencilSimple size={18} aria-hidden="true" />Editar
                </Button>
                <Button variant="ghost" aria-label={`Excluir ${statblock.name}`} onClick={() => setConfirmingDelete(true)}>
                  <Trash size={18} aria-hidden="true" />
                </Button>
              </>
            )}
          />

          {confirmingDelete && (
            <div className="sheet-confirm" role="group" aria-label={`Confirmar exclusão de ${statblock.name}`}>
              <p className="sheet-confirm__question">
                <Warning size={18} weight="fill" aria-hidden="true" />
                Excluir {statblock.name} do bestiário?
              </p>
              <p className="sheet-confirm__detail">
                Não há como recuperar a criatura. Combatentes já criados a partir dela continuam nos encontros.
              </p>
              {remove.isError && (
                <p role="alert" className="text-small text-danger-text">{errorMessage(remove.error)}</p>
              )}
              <div className="qf-dialog__actions">
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Manter criatura</Button>
                <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                  <Trash size={18} aria-hidden="true" />
                  Excluir criatura
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
