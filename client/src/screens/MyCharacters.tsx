import { useState } from 'react';
import { Plus, UserCircle } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { CharacterSheet, MyCharacter, MyCharacterListResponse } from '@quest-fast/shared';
import { Button as ActionButton } from '../components/Button';
import { CharacterGallery } from '../components/CharacterGallery';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { SelectField } from '../components/SelectField';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { Button } from '../components/ui/button';
import { useNotify } from '../hooks/use-notify';
import { ApiError, api } from '../lib/api';
import { dialogActions, eyebrow, page } from '../components/layout-styles';
import { cn } from '../lib/utils';
import { CharacterFormDialog } from './campaign/CharacterFormDialog';
import { CharacterSheetDialog } from './campaign/CharacterSheetDialog';

const MY_CHARACTERS = ['my-characters'];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** A sheet always belongs to a campaign, so creating one starts by choosing it. */
function ChooseCampaign({ campaigns, onChoose, onCancel }: {
  campaigns: { id: string; name: string }[]; onChoose: (campaignId: string) => void; onCancel: () => void;
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }} title="Novo personagem"
      description="Todo personagem joga em uma campanha. Escolha a mesa; depois você preenche a ficha ou importa o PDF.">
      <form onSubmit={(event) => { event.preventDefault(); onChoose(campaignId); }}>
        <SelectField label="Campanha" value={campaignId} onChange={setCampaignId}>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </SelectField>
        <div className={dialogActions}>
          <ActionButton variant="ghost" onClick={onCancel}>Cancelar</ActionButton>
          <ActionButton type="submit">Continuar</ActionButton>
        </div>
      </form>
    </Dialog>
  );
}

type Editing = { campaignId: string; character: CharacterSheet | null };

function summary(list: MyCharacter[]) {
  if (list.length === 0) return 'Sua conta';
  const campaigns = new Set(list.map((character) => character.campaignId)).size;
  return `${plural(list.length, 'personagem', 'personagens')} em ${plural(campaigns, 'campanha', 'campanhas')}`;
}

function GalleryStatus({ characters, noCampaign, canCreate, onCreate }: {
  characters: UseQueryResult<MyCharacterListResponse>; noCampaign: boolean; canCreate: boolean; onCreate: () => void;
}) {
  if (characters.isPending) {
    return (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]" aria-busy="true" aria-label="Carregando personagens">
        {[0, 1, 2].map((card) => <Skeleton key={card} shape="panel" />)}
      </div>
    );
  }
  if (characters.isError) {
    return (
      <Surface className="grid justify-items-start gap-3">
        <p role="alert" className="text-body text-danger-text">{errorMessage(characters.error)}</p>
        <ActionButton variant="secondary" loading={characters.isFetching} onClick={() => characters.refetch()}>Tentar novamente</ActionButton>
      </Surface>
    );
  }
  if (characters.data.characters.length > 0) return null;
  return (
    <Surface>
      {noCampaign ? (
        <EmptyState icon={UserCircle} title="Primeiro, uma mesa"
          description="Todo personagem joga em uma campanha. Crie a sua ou entre em uma com o código do mestre."
          action={<Button asChild variant="secondary"><Link to="/campaigns">Ver campanhas</Link></Button>} />
      ) : (
        <EmptyState icon={UserCircle} title="Nenhum personagem ainda"
          description="Crie seu personagem escolhendo a campanha. Dá para começar do zero ou importar o PDF da ficha oficial."
          action={<ActionButton onClick={onCreate} disabled={!canCreate}><Plus size={18} aria-hidden="true" /> Criar personagem</ActionButton>} />
      )}
    </Surface>
  );
}

/**
 * Reading and editing share one layer: the editor replaces the sheet, and
 * closing it comes back to the gallery.
 */
function SheetLayer({ viewing, editing, currentUserId, onClose, onEdit, onEditDone, onChanged }: {
  viewing: MyCharacter | null; editing: Editing | null; currentUserId: string;
  onClose: () => void; onEdit: (editing: Editing) => void; onEditDone: () => void; onChanged: (campaignId: string) => void;
}) {
  const notify = useNotify();
  if (editing) {
    const creating = editing.character === null;
    return (
      <CharacterFormDialog campaignId={editing.campaignId} character={editing.character} open
        onOpenChange={(open) => { if (!open) onEditDone(); }}
        onSaved={() => {
          onChanged(editing.campaignId);
          notify(creating
            ? { variant: 'success', title: 'Personagem criado', description: 'A mesa da campanha já pode ver a ficha.' }
            : { variant: 'success', title: 'Ficha salva', description: 'As alterações já valem na mesa.' });
        }}
        onSaveError={(message) => notify({
          variant: 'error',
          title: creating ? 'Não foi possível criar o personagem' : 'Não foi possível salvar a ficha',
          description: message,
        })} />
    );
  }
  if (!viewing) return null;
  return (
    <CharacterSheetDialog campaignId={viewing.campaignId} characterId={viewing.id} currentUserId={currentUserId}
      isMaster={false} context="gallery" open
      onOpenChange={(open) => { if (!open) onClose(); }}
      onEdit={(sheet) => onEdit({ campaignId: sheet.campaignId, character: sheet })}
      onDeleted={() => onChanged(viewing.campaignId)} />
  );
}

/**
 * The account gallery: every character of the player, with its campaign. It
 * is for looking and managing (create, edit, portrait, delete, activate);
 * rolling and spending the turn happen on the campaign's table.
 */
export function MyCharacters({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const characters = useQuery({ queryKey: MY_CHARACTERS, queryFn: api.myCharacters });
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  const [selectedId, setSelectedId] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [viewing, setViewing] = useState<MyCharacter | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  // The gallery and the campaign's own caches show the same sheets.
  const reload = (campaignId: string) => {
    void queryClient.invalidateQueries({ queryKey: MY_CHARACTERS });
    void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
    void queryClient.invalidateQueries({ queryKey: ['character', campaignId] });
  };

  const activate = useMutation({
    mutationFn: (character: MyCharacter) => api.activateCharacter(character.campaignId, character.id),
    onSuccess: (_, character) => {
      reload(character.campaignId);
      notify({ variant: 'success', title: `${character.name} está ativo`, description: `É quem você leva à mesa de ${character.campaignName}.` });
    },
    onError: (error) => notify({ variant: 'error', title: 'Não foi possível ativar o personagem', description: errorMessage(error) }),
  });

  const list = characters.data?.characters ?? [];
  const joined = campaigns.data?.campaigns ?? [];
  const startCreating = () => setChoosing(true);

  const actions = (character: MyCharacter) => character.active
    ? (
      <Button asChild size="sm">
        <Link to="/campaigns/$campaignId/table" params={{ campaignId: character.campaignId }}>
          Ir para a mesa
        </Link>
      </Button>
    )
    : (
      <Button variant="secondary" size="sm" disabled={activate.isPending} onClick={() => activate.mutate(character)}>
        {activate.isPending && activate.variables?.id === character.id ? 'Ativando…' : 'Ativar nesta campanha'}
      </Button>
    );

  return (
    <main data-slot="page" className={cn(page, 'mx-auto w-full max-w-[1200px] p-4 sm:p-8')}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-6 max-[479px]:gap-4 [&_h1]:mt-2 [&_h1]:font-display [&_h1]:text-display [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] @max-[480px]:[&_h1]:text-h1">
        <div>
          <p className={eyebrow}>{summary(list)}</p>
          <h1>Meus personagens</h1>
        </div>
        {joined.length > 0 && (
          <ActionButton onClick={startCreating}>
            <Plus size={18} aria-hidden="true" /> Novo personagem
          </ActionButton>
        )}
      </header>

      <GalleryStatus characters={characters} noCampaign={campaigns.isSuccess && joined.length === 0}
        canCreate={joined.length > 0} onCreate={startCreating} />

      {list.length > 0 && (
        <CharacterGallery characters={list} selectedId={selectedId} onSelect={setSelectedId}
          onOpen={setViewing} onCreate={startCreating} actions={actions} />
      )}

      {choosing && (
        <ChooseCampaign campaigns={joined} onCancel={() => setChoosing(false)}
          onChoose={(campaignId) => { setChoosing(false); setEditing({ campaignId, character: null }); }} />
      )}

      <SheetLayer viewing={viewing} editing={editing} currentUserId={currentUserId}
        onClose={() => setViewing(null)} onEdit={setEditing} onEditDone={() => setEditing(null)} onChanged={reload} />
    </main>
  );
}
