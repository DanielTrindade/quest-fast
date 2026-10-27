import { useState } from 'react';
import { Skull } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EncounterListItem, Statblock } from '@quest-fast/shared';
import { BestiaryList } from '../../components/BestiaryList';
import { Button } from '../../components/Button';
import { EncounterList } from '../../components/EncounterList';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { Toast } from '../../components/Toast';
import { ApiError, api } from '../../lib/api';
import { encounterQuery, encountersQuery, isDeletedEncounter, mergeEncounter } from '../../lib/combat-cache';
import { EncounterPanel } from './EncounterPanel';
import { StatblockDialog } from './StatblockDialog';
import { StatblockFormDialog } from './StatblockFormDialog';

/**
 * The fight in progress; once it ends, the one that was being followed, so
 * its summary stays in sight. A player arriving with no fight lands on the
 * one that ended last, which is not the one created last.
 */
function defaultEncounter(encounters: EncounterListItem[], isMaster: boolean, followedId: string | null): string | null {
  const active = encounters.find((encounter) => encounter.status === 'active');
  if (active) return active.id;
  if (encounters.some((encounter) => encounter.id === followedId)) return followedId;
  if (isMaster) return null;
  const lastEnded = encounters
    .filter((encounter) => encounter.endedAt !== null)
    .reduce<EncounterListItem | undefined>((last, encounter) => (!last || encounter.endedAt! > last.endedAt! ? encounter : last), undefined);
  return (lastEnded ?? encounters[0])?.id ?? null;
}

/**
 * Which encounter is open: the one picked, or else the one being followed.
 * A picked encounter that was deleted is forgotten for good, and the screen
 * falls back as if nothing had been picked.
 */
function useOpenEncounter(campaignId: string, list: EncounterListItem[], isMaster: boolean) {
  // `undefined`: nobody picked yet, so the screen follows the fight in progress.
  const [chosenId, setChosenId] = useState<string | null | undefined>(undefined);
  // The same query the open panel runs, watched here too: a deletion missed
  // while offline only shows up as its 404, and the list may not change then.
  useQuery({ ...encounterQuery(campaignId, chosenId ?? ''), enabled: typeof chosenId === 'string' });
  const [followedId, setFollowedId] = useState<string | null>(null);
  // Remembered while rendering, not in an effect: the render that sees the
  // fight end already keeps it open.
  const activeId = list.find((encounter) => encounter.status === 'active')?.id;
  if (activeId && activeId !== followedId) setFollowedId(activeId);
  const chosenGone = typeof chosenId === 'string' && isDeletedEncounter(chosenId);
  if (chosenGone) setChosenId(undefined);
  const openId = chosenId === undefined || chosenGone ? defaultEncounter(list, isMaster, followedId) : chosenId;
  return { openId, setChosenId };
}

function Loading({ label }: { label: string }) {
  return (
    <div className="qf-stack" role="region" aria-label={label} aria-busy="true">
      <Skeleton width="40%" />
      <Skeleton shape="panel" />
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="qf-stack">
      <p role="alert" className="text-body text-danger-text">{message}</p>
      <div>
        <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>
      </div>
    </div>
  );
}

/** The master's bestiary: the list, viewing and editing share one dialog layer. */
function Bestiary({ campaignId, onNotice }: { campaignId: string; onNotice: (notice: string) => void }) {
  const queryClient = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Statblock | null | 'new'>(null);

  const statblocks = useQuery({
    queryKey: ['statblocks', campaignId],
    queryFn: () => api.statblocks(campaignId),
  });

  const reloadList = () => queryClient.invalidateQueries({ queryKey: ['statblocks', campaignId] });

  return (
    <Surface>
      <h3 className="campaign-combat__title">
        Bestiário
        {statblocks.isSuccess && <span className="campaign-combat__count">{statblocks.data.statblocks.length} criaturas</span>}
      </h3>

      {statblocks.isPending && <Loading label="Carregando bestiário" />}
      {statblocks.isError && <LoadError message="Não foi possível carregar o bestiário." onRetry={() => statblocks.refetch()} />}
      {statblocks.isSuccess && (
        <BestiaryList statblocks={statblocks.data.statblocks} onOpen={setViewingId} onCreate={() => setEditing('new')} />
      )}

      {editing === null && viewingId && (
        <StatblockDialog
          campaignId={campaignId}
          statblockId={viewingId}
          onClose={() => setViewingId(null)}
          onEdit={setEditing}
          onDeleted={(name) => {
            setViewingId(null);
            queryClient.removeQueries({ queryKey: ['statblock', campaignId, viewingId] });
            reloadList();
            onNotice(`${name} saiu do bestiário.`);
          }}
        />
      )}

      {editing !== null && (
        <StatblockFormDialog
          campaignId={campaignId}
          statblock={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            queryClient.setQueryData(['statblock', campaignId, saved.id], { statblock: saved });
            reloadList();
            setEditing(null);
            // A new creature opens right away, so the master sees what was saved.
            setViewingId(saved.id);
            onNotice(created ? `${saved.name} entrou no bestiário.` : `Alterações em ${saved.name} salvas.`);
          }}
        />
      )}
    </Surface>
  );
}

/**
 * The campaign's combat. The master prepares and runs encounters and keeps
 * the bestiary; a player follows the fight in progress or the last one. What
 * each one receives was already projected by the server.
 */
export function CombatSection({ campaignId, isMaster, currentUserId }: {
  campaignId: string;
  isMaster: boolean;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const encounters = useQuery(encountersQuery(campaignId));
  const list = encounters.data?.encounters ?? [];
  const { openId, setChosenId } = useOpenEncounter(campaignId, list, isMaster);

  const create = useMutation({
    mutationFn: (name: string) => api.createEncounter(campaignId, name),
    onSuccess: ({ encounter }) => {
      setCreateError(null);
      mergeEncounter(queryClient, campaignId, encounter);
      setChosenId(encounter.id);
    },
    onError: (error) => setCreateError(error instanceof ApiError ? error.message : 'Não foi possível criar o encontro.'),
  });

  return (
    <section className="campaign-combat" aria-labelledby="combat-title">
      <div className="campaign-section-heading">
        <h2 id="combat-title">
          <Skull size={20} aria-hidden="true" /> Combate
        </h2>
      </div>

      <Surface>
        {encounters.isPending && <Loading label="Carregando encontros" />}
        {encounters.isError && <LoadError message="Não foi possível carregar os encontros." onRetry={() => encounters.refetch()} />}

        {encounters.isSuccess && openId && (
          <EncounterPanel
            key={openId}
            campaignId={campaignId}
            encounterId={openId}
            isMaster={isMaster}
            currentUserId={currentUserId}
            onBack={isMaster || list.length > 1 ? () => setChosenId(null) : undefined}
            onDeleted={(name) => {
              setChosenId(null);
              setNotice(`${name} foi excluído.`);
            }}
          />
        )}

        {encounters.isSuccess && !openId && (
          <div className="qf-stack">
            <h3 className="campaign-combat__title">Encontros</h3>
            <EncounterList
              encounters={list}
              onOpen={setChosenId}
              onCreate={isMaster ? (name) => create.mutateAsync(name) : undefined}
              creating={create.isPending}
            />
            {createError && <p role="alert" className="text-body text-danger-text">{createError}</p>}
          </div>
        )}
      </Surface>

      {isMaster && <Bestiary campaignId={campaignId} onNotice={setNotice} />}

      <Toast
        open={notice !== null}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        variant="success"
        title={notice ?? ''}
      />
    </section>
  );
}
