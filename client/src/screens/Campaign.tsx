import { useState } from 'react';
import { Users } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { CampaignMember } from '@quest-fast/shared';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CopyField } from '../components/CopyField';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { Toast } from '../components/Toast';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/format';
import '../styles/campaign.css';

/** Visible copy stays in Portuguese — it is what the table reads. */
function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

function RemoveMember({
  campaignId,
  member,
  onRemoved,
}: {
  campaignId: string;
  member: CampaignMember;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.removeMember(campaignId, member.id),
    onSuccess: () => {
      setOpen(false);
      onRemoved();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" aria-label={`Remover ${member.name}`}>
          Remover
        </Button>
      }
      title={`Remover ${member.name}?`}
      description="Esta pessoa deixará de participar da campanha. Você poderá convidá-la novamente."
    >
      {remove.isError && (
        <p role="alert" className="text-small text-danger-text">
          {errorMessage(remove.error)}
        </p>
      )}
      <div className="qf-dialog__actions">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
          Remover jogador
        </Button>
      </div>
    </Dialog>
  );
}

function LeaveCampaign({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const leave = useMutation({
    mutationFn: () => api.leaveCampaign(campaignId),
    onSuccess: () => navigate({ to: '/campaigns' }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost">Sair da campanha</Button>}
      title="Sair desta campanha?"
      description="Você perde o acesso ao conteúdo da mesa. Para voltar, precisará do código de convite."
    >
      {leave.isError && (
        <p role="alert" className="text-small text-danger-text">
          {errorMessage(leave.error)}
        </p>
      )}
      <div className="qf-dialog__actions">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Ficar
        </Button>
        <Button variant="danger" loading={leave.isPending} onClick={() => leave.mutate()}>
          Sair da campanha
        </Button>
      </div>
    </Dialog>
  );
}

export function Campaign({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [removed, setRemoved] = useState(false);

  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.campaign(campaignId),
  });
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.members(campaignId),
  });

  const onRemoved = () => {
    setRemoved(true);
    queryClient.invalidateQueries({ queryKey: ['members', campaignId] });
  };

  if (campaign.isError) {
    return (
      <main className="qf-page mx-auto w-full max-w-3xl p-4 sm:p-8">
        <Surface>
          <p role="alert" className="text-body text-danger-text">
            {errorMessage(campaign.error)}
          </p>
        </Surface>
      </main>
    );
  }

  const isMaster = campaign.data?.role === 'master';

  return (
    <main className="qf-page mx-auto w-full max-w-6xl p-4 sm:p-8">
      <header className="campaign-heading">
        <div className="min-w-0">
          <p className="campaign-eyebrow">Sua mesa</p>
          <h1>{campaign.data?.name ?? 'Carregando…'}</h1>
          {campaign.data?.description && <p className="campaign-description">{campaign.data.description}</p>}
        </div>
        {!campaign.isPending && !isMaster && <LeaveCampaign campaignId={campaignId} />}
      </header>

      <div className="campaign-layout">
        <section className="campaign-members" aria-labelledby="members-title">
          <div className="campaign-section-heading">
            <h2 id="members-title">
              <Users size={20} aria-hidden="true" />
              Membros
            </h2>
            <span>{members.isSuccess ? `${members.data.members.length} na mesa` : 'Carregando…'}</span>
          </div>

          <Surface className="campaign-roster">
            {members.isPending && (
              <div className="qf-stack" role="region" aria-label="Carregando membros" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="qf-member">
                    <Skeleton shape="avatar" />
                    <div className="qf-stack">
                      <Skeleton width="60%" />
                      <Skeleton width="80%" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {members.isError && (
              <p role="alert" className="text-body text-danger-text">
                {errorMessage(members.error)}
              </p>
            )}

            {members.isSuccess && (
              <ul>
                {members.data.members.map((member) => (
                  <li key={member.id} className="qf-member">
                    <Avatar name={member.name} src={member.avatarUrl ?? undefined} />
                    <div className="campaign-member-info">
                      <span className="campaign-member-name">{member.name}</span>
                      <span className="campaign-member-date">Entrou em {formatDate(member.joinedAt)}</span>
                    </div>
                    {/* Role and Badge share the same vocabulary, so no mapping. */}
                    <Badge role={member.role} />
                    {isMaster && member.role === 'player' && (
                      <RemoveMember campaignId={campaignId} member={member} onRemoved={onRemoved} />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {members.isSuccess && members.data.members.length === 1 && isMaster && (
              <EmptyState
                title="Falta reunir a mesa"
                description="Compartilhe o código de convite para os jogadores entrarem."
                action={null}
              />
            )}
          </Surface>

          <p className="campaign-footnote">
            {isMaster
              ? 'Você é o mestre desta campanha e gerencia quem participa.'
              : 'O mestre gerencia os convites e os membros desta campanha.'}
          </p>
        </section>

        <aside className="campaign-aside" aria-label="Convite">
          {/* The code only reaches the master; the API omits it for a player. */}
          {campaign.data?.inviteCode && (
            <Surface>
              <p className="campaign-eyebrow">Convite</p>
              <p className="mt-1 mb-3 text-small text-text-secondary">
                Quem tiver este código entra na campanha como jogador.
              </p>
              <CopyField value={campaign.data.inviteCode} />
            </Surface>
          )}
        </aside>
      </div>

      <Toast
        open={removed}
        onOpenChange={setRemoved}
        variant="success"
        title="Jogador removido"
        description="A lista de membros foi atualizada."
      />
    </main>
  );
}
