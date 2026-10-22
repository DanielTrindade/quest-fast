import { useState } from 'react';
import { Skull } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Statblock } from '@quest-fast/shared';
import { BestiaryList } from '../../components/BestiaryList';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { Toast } from '../../components/Toast';
import { api } from '../../lib/api';
import { StatblockDialog } from './StatblockDialog';
import { StatblockFormDialog } from './StatblockFormDialog';

/**
 * The master's combat area. Today it holds the bestiary; encounters arrive in
 * the next delivery. Rendered only for the master — the API answers 403 to a
 * player anyway.
 */
export function CombatSection({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Statblock | null | 'new'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statblocks = useQuery({
    queryKey: ['statblocks', campaignId],
    queryFn: () => api.statblocks(campaignId),
  });

  const reloadList = () => queryClient.invalidateQueries({ queryKey: ['statblocks', campaignId] });

  return (
    <section className="campaign-combat" aria-labelledby="combat-title">
      <div className="campaign-section-heading">
        <h2 id="combat-title">
          <Skull size={20} aria-hidden="true" /> Combate
        </h2>
        {statblocks.isSuccess && <span>{statblocks.data.statblocks.length} no bestiário</span>}
      </div>

      <Surface>
        <h3 className="campaign-combat__title">Bestiário</h3>

        {statblocks.isPending && (
          <div className="qf-stack" role="region" aria-label="Carregando bestiário" aria-busy="true">
            <Skeleton width="40%" />
            <Skeleton shape="panel" />
          </div>
        )}

        {statblocks.isError && (
          <div className="qf-stack">
            <p role="alert" className="text-body text-danger-text">Não foi possível carregar o bestiário.</p>
            <div>
              <Button variant="secondary" onClick={() => statblocks.refetch()}>Tentar novamente</Button>
            </div>
          </div>
        )}

        {statblocks.isSuccess && (
          <BestiaryList
            statblocks={statblocks.data.statblocks}
            onOpen={setViewingId}
            onCreate={() => setEditing('new')}
          />
        )}
      </Surface>

      {/* Viewing and editing share one layer, like the character sheet. */}
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
            setNotice(`${name} saiu do bestiário.`);
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
            setNotice(created ? `${saved.name} entrou no bestiário.` : `Alterações em ${saved.name} salvas.`);
          }}
        />
      )}

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
