import { useState } from 'react';
import { ArrowRight, Sword } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button as RetryButton } from '../../components/Button';
import { CharacterRow } from '../../components/CharacterRow';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { CharacterSheetDialog } from './CharacterSheetDialog';
import { memberRow, sectionHeading, stack } from '../../components/layout-styles';

const toGallery = (
  <Button asChild variant="secondary" size="sm">
    <Link to="/characters">Meus personagens <ArrowRight size={16} aria-hidden="true" /></Link>
  </Button>
);

/**
 * The group at the table: each player's active character. Sheets are created,
 * edited and swapped in the account gallery; here they are played.
 */
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

  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () => api.characters(campaignId),
  });
  const party = characters.data?.characters.filter((character) => character.active) ?? [];

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
    void queryClient.invalidateQueries({ queryKey: ['character', campaignId] });
    void queryClient.invalidateQueries({ queryKey: ['my-characters'] });
  };

  return (
    <section aria-labelledby="characters-title">
      <div className={sectionHeading}>
        <h2 id="characters-title">
          <Sword size={20} aria-hidden="true" /> Personagens
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {characters.isSuccess && <span>{party.length} na mesa</span>}
          {toGallery}
        </div>
      </div>

      <Surface className="py-0">
        {characters.isPending && (
          <div className={stack} role="region" aria-label="Carregando personagens" aria-busy="true">
            {[0, 1].map((row) => (
              <div key={row} className={memberRow}>
                <Skeleton shape="avatar" />
                <div className={stack}>
                  <Skeleton width="50%" />
                  <Skeleton width="70%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {characters.isError && (
          <div className={stack}>
            <p role="alert" className="text-body text-danger-text">
              Não foi possível carregar os personagens.
            </p>
            <div>
              <RetryButton variant="secondary" onClick={() => characters.refetch()}>
                Tentar novamente
              </RetryButton>
            </div>
          </div>
        )}

        {characters.isSuccess && party.length === 0 && (
          <EmptyState
            title="Nenhum personagem na mesa"
            icon={Sword}
            description="Cada jogador traz um personagem ativo por campanha. Crie ou ative o seu em Meus personagens."
            action={toGallery}
          />
        )}

        {party.length > 0 && (
          <ul data-slot="characters-list" className="m-0 list-none p-0 [&>li+li]:border-t [&>li+li]:border-border">
            {party.map((character) => (
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

      {viewingId && (
        <CharacterSheetDialog
          campaignId={campaignId}
          characterId={viewingId}
          currentUserId={currentUserId}
          isMaster={isMaster}
          open
          onOpenChange={(open) => {
            if (!open) setViewingId(null);
          }}
          onDeleted={reload}
        />
      )}
    </section>
  );
}
