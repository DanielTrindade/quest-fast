import { useState } from 'react';
import { Plus, Sword } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CharacterSheet, CharacterSummary } from '@quest-fast/shared';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { api } from '../../lib/api';
import { CharacterFormDialog } from './CharacterFormDialog';
import { CharacterSheetDialog } from './CharacterSheetDialog';

export function CharactersSection({
  campaignId,
  currentUserId,
  isMaster,
}: {
  campaignId: string;
  currentUserId: string;
  isMaster: boolean;
}) {
  const queryClient = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CharacterSheet | null | 'new'>(null);

  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () => api.characters(campaignId),
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['character', campaignId] });
  };

  return (
    <section className="campaign-characters" aria-labelledby="characters-title">
      <div className="campaign-section-heading">
        <h2 id="characters-title">
          <Sword size={20} aria-hidden="true" /> Personagens
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {characters.isSuccess && <span>{characters.data.characters.length} na mesa</span>}
          <Button onClick={() => setEditing('new')}>
            <Plus size={18} aria-hidden="true" />
            Novo personagem
          </Button>
        </div>
      </div>

      <Surface className="characters-surface">
        {characters.isPending && (
          <div className="qf-stack" role="region" aria-label="Carregando personagens" aria-busy="true">
            {[0, 1].map((row) => (
              <div key={row} className="qf-member">
                <Skeleton shape="avatar" />
                <div className="qf-stack">
                  <Skeleton width="50%" />
                  <Skeleton width="70%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {characters.isError && (
          <div className="qf-stack">
            <p role="alert" className="text-body text-danger-text">
              Não foi possível carregar os personagens.
            </p>
            <div>
              <Button variant="secondary" onClick={() => characters.refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {characters.isSuccess && characters.data.characters.length === 0 && (
          <EmptyState
            title="Nenhum personagem ainda"
            icon={Sword}
            description="Crie seu personagem; a mesa toda poderá ver a ficha e acompanhar suas rolagens."
            action={
              <Button onClick={() => setEditing('new')}>
                <Plus size={18} aria-hidden="true" />
                Criar personagem
              </Button>
            }
          />
        )}

        {characters.isSuccess && characters.data.characters.length > 0 && (
          <ul className="characters-list">
            {characters.data.characters.map((character) => (
              <CharacterRow
                key={character.id}
                character={character}
                isMine={character.ownerId === currentUserId}
                onOpen={() => setViewingId(character.id)}
              />
            ))}
          </ul>
        )}
      </Surface>

      {/* Consultation and editing share one layer. Opening the editor replaces
          the sheet instead of stacking over it, and closing it comes back. */}
      {editing === null && viewingId && (
        <CharacterSheetDialog
          campaignId={campaignId}
          characterId={viewingId}
          currentUserId={currentUserId}
          isMaster={isMaster}
          open
          onOpenChange={(open) => {
            if (!open) setViewingId(null);
          }}
          onEdit={(sheet) => setEditing(sheet)}
          onDeleted={reload}
        />
      )}

      {editing !== null && (
        <CharacterFormDialog
          campaignId={campaignId}
          character={editing === 'new' ? null : editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={reload}
        />
      )}
    </section>
  );
}

function CharacterRow({
  character,
  isMine,
  onOpen,
}: {
  character: CharacterSummary;
  isMine: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" className="character-row" onClick={onOpen}>
        <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="md" />
        <span className="character-row__info">
          <span className="character-row__name">
            <b>{character.name}</b>
            {isMine && <span className="character-row__mine">Seu personagem</span>}
          </span>
          <span className="character-row__class">
            {character.race} · {character.class} · nível {character.level}
          </span>
          <span className="character-row__owner">{character.ownerName}</span>
        </span>
      </button>
    </li>
  );
}
