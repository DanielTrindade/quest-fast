import { useState } from 'react';
import { Users } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { invitePath, type CampaignDetail, type CampaignMember } from '@quest-fast/shared';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BannedList } from '../../components/BannedList';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { InviteHero } from '../../components/InviteHero';
import { Skeleton } from '../../components/Skeleton';
import { Surface } from '../../components/Surface';
import { dialogActions, memberRow, sectionHeading, stack } from '../../components/layout-styles';
import { useNotify } from '../../hooks/use-notify';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { cn } from '../../lib/utils';
import { CampaignPage } from './CampaignPage';
import { errorMessage, useCampaignScreen } from './campaign-screen';

const rosterRow = 'col-span-full grid grid-cols-subgrid @max-[480px]:grid-cols-[40px_minmax(0,1fr)] [&>[data-slot=badge]]:col-start-3 [&>[data-slot=badge]]:justify-self-start [&>button]:col-start-4 [&>button]:justify-self-start @max-[480px]:[&>[data-slot=badge]]:col-start-2 @max-[480px]:[&>button]:col-start-2';

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
      description="Esta pessoa sairá da campanha e não poderá voltar por convite até você liberar a entrada."
    >
      {remove.isError && (
        <p role="alert" className="text-small text-danger-text">
          {errorMessage(remove.error)}
        </p>
      )}
      <div className={dialogActions}>
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
  const queryClient = useQueryClient();
  const leave = useMutation({
    mutationFn: () => api.leaveCampaign(campaignId),
    onSuccess: () => {
      // The campaign left by the user must disappear from the list cache.
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate({ to: '/campaigns' });
    },
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
      <div className={dialogActions}>
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

function BannedSection({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const bans = useQuery({
    queryKey: ['campaign', campaignId, 'bans'],
    queryFn: () => api.bans(campaignId),
  });
  const unban = useMutation({
    mutationFn: (userId: string) => api.unban(campaignId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'bans'] }),
  });

  if (!bans.data || bans.data.bans.length === 0) return null;
  return (
    <Surface className="min-w-0">
      <BannedList
        bans={bans.data.bans}
        onUnban={(userId) => unban.mutate(userId)}
        unbanning={unban.isPending ? unban.variables : undefined}
      />
      {unban.isError && (
        <p role="alert" className="mt-3 text-small text-danger-text">
          {errorMessage(unban.error)}
        </p>
      )}
    </Surface>
  );
}

/**
 * The master's invite, as the subject of the screen. The card image is the
 * one the server renders for link previews; a new code changes its address.
 */
function Invite({ campaignId, campaign }: { campaignId: string; campaign: CampaignDetail & { inviteCode: string } }) {
  const queryClient = useQueryClient();
  const rotate = useMutation({
    mutationFn: () => api.rotateInvite(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
  const code = campaign.inviteCode;
  return (
    <InviteHero link={window.location.origin + invitePath(code)} code={code} campaignName={campaign.name}
      previewUrl={`/api/invites/${encodeURIComponent(code)}/card.png`}
      onRotate={() => rotate.mutate()} rotating={rotate.isPending}
      rotateError={rotate.isError ? errorMessage(rotate.error) : undefined} />
  );
}

/** Who is at the table, the invite and, for the master, who was removed. */
export function CampaignPlayers({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { campaign, isMaster } = useCampaignScreen(campaignId);
  const inviteCode = campaign.data?.role === 'master' ? campaign.data.inviteCode : null;
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.members(campaignId),
  });

  const onRemoved = () => {
    notify({ variant: 'success', title: 'Jogador removido', description: 'A lista de membros foi atualizada.' });
    queryClient.invalidateQueries({ queryKey: ['members', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'bans'] });
  };

  return (
    <CampaignPage
      campaign={campaign}
      title="Jogadores"
      actions={campaign.isPending || isMaster ? null : <LeaveCampaign campaignId={campaignId} />}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 @min-[1000px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {campaign.data && inviteCode && <Invite campaignId={campaignId} campaign={{ ...campaign.data, inviteCode }} />}
        <section data-slot="campaign-admin" className="grid min-w-0 max-w-[760px] gap-4" aria-labelledby="members-title">
          <div className={sectionHeading}>
            <h2 id="members-title">
              <Users size={20} aria-hidden="true" />
              Membros
            </h2>
            <span>{members.isSuccess ? `${members.data.members.length} na mesa` : 'Carregando…'}</span>
          </div>

          <Surface className="py-0">
            {members.isPending && (
              <div className={stack} role="region" aria-label="Carregando membros" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className={memberRow}>
                    <Skeleton shape="avatar" />
                    <div className={stack}>
                      <Skeleton width="60%" />
                      <Skeleton width="80%" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {members.isError && (
              <div className={stack}>
                <p role="alert" className="text-body text-danger-text">
                  {errorMessage(members.error)}
                </p>
                <div>
                  <Button variant="secondary" onClick={() => members.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            {members.isSuccess && (
              // The master's row has no action: shared columns keep the role badge
              // in its own column instead of sliding into the button's slot.
              <ul className="m-0 grid list-none grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-3 p-0 @max-[480px]:block">
                {members.data.members.map((member) => (
                  <li key={member.id} className={cn(memberRow, rosterRow)}>
                    <Avatar name={member.name} src={member.avatarUrl ?? undefined} />
                    <div className="grid min-w-0 flex-[1_1_120px] gap-1">
                      <span data-slot="member-name" className="font-medium">{member.name}</span>
                      <span className="text-small text-text-muted">Entrou em {formatDate(member.joinedAt)}</span>
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
                icon={Users}
                description="Compartilhe o link de convite para os jogadores entrarem."
                action={null}
              />
            )}
          </Surface>

          {isMaster && <BannedSection campaignId={campaignId} />}

          <p className="text-small text-text-muted">
            {isMaster
              ? 'Você é o mestre desta campanha e gerencia quem participa.'
              : 'O mestre gerencia os convites e os membros desta campanha.'}
          </p>
        </section>
      </div>
    </CampaignPage>
  );
}
