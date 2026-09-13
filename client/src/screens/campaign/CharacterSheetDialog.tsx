import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CharacterSheet, CharacterStateInput, LinkedRollRequest, RollPayload } from '@quest-fast/shared';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Skeleton } from '../../components/Skeleton';
import { ApiError, api } from '../../lib/api';
import { CharacterSheetView } from './CharacterSheetView';

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

export function CharacterSheetDialog({
  campaignId,
  characterId,
  currentUserId,
  isMaster,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
}: {
  campaignId: string;
  characterId: string;
  currentUserId: string;
  isMaster: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (sheet: CharacterSheet) => void;
  onDeleted: () => void;
}) {
  const [lastRoll, setLastRoll] = useState<RollPayload | null>(null);
  // The confirmation lives inside the sheet instead of a second dialog: a
  // destructive step should not stack another layer over what it destroys.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const sheet = useQuery({
    queryKey: ['character', campaignId, characterId],
    queryFn: () => api.character(campaignId, characterId),
    enabled: open,
  });
  const character = sheet.data?.character;

  const roll = useMutation({
    mutationFn: (request: LinkedRollRequest) => api.characterRoll(campaignId, characterId, request),
    onSuccess: (response) => setLastRoll(response.event.payload),
  });
  // Play state saves on its own route; the answer is the whole sheet, and the
  // roster shows current hit points, so it refreshes too.
  const queryClient = useQueryClient();
  const changeState = useMutation({
    mutationFn: (state: CharacterStateInput) => api.updateCharacterState(campaignId, characterId, state),
    onSuccess: (response) => {
      queryClient.setQueryData(['character', campaignId, characterId], response);
      queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteCharacter(campaignId, characterId),
    onSuccess: () => {
      onOpenChange(false);
      onDeleted();
    },
  });

  const isOwner = character?.ownerId === currentUserId;

  return (
    <Dialog
      className="qf-dialog--sheet"
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setLastRoll(null);
          setConfirmingDelete(false);
          roll.reset();
          changeState.reset();
          remove.reset();
        }
      }}
      title={character?.name ?? 'Ficha'}
      description={
        character ? `${character.race} · ${character.class} · nível ${character.level}` : 'Carregando ficha…'
      }
    >
      {sheet.isPending && (
        <div className="qf-stack" aria-busy="true" aria-label="Carregando ficha">
          <Skeleton shape="line" width="60%" />
          <Skeleton shape="panel" />
          <Skeleton shape="panel" />
        </div>
      )}

      {sheet.isError && (
        <div className="qf-stack">
          <p role="alert" className="text-body text-danger-text">
            {errorMessage(sheet.error)}
          </p>
          <div>
            <Button variant="secondary" onClick={() => sheet.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {character && (
        <CharacterSheetView
          character={character}
          isOwner={isOwner}
          canDelete={isOwner || isMaster}
          rolling={roll.isPending}
          rollError={roll.isError ? errorMessage(roll.error) : null}
          lastRoll={lastRoll}
          stateSaving={changeState.isPending}
          stateError={changeState.isError ? errorMessage(changeState.error) : null}
          onStateChange={isOwner ? (state) => changeState.mutate(state) : undefined}
          confirmingDelete={confirmingDelete}
          deleting={remove.isPending}
          deleteError={remove.isError ? errorMessage(remove.error) : null}
          onRoll={roll.mutate}
          onEdit={() => onEdit(character)}
          onAskDelete={() => setConfirmingDelete(true)}
          onCancelDelete={() => setConfirmingDelete(false)}
          onConfirmDelete={() => remove.mutate()}
        />
      )}
    </Dialog>
  );
}
