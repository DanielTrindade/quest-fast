import { useState } from 'react';
import { ArrowLeft, CaretRight, Plus, Users } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { invitePath, type CampaignDetail, type CampaignMember, type MembersResponse } from '@quest-fast/shared';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { BannedList } from '../components/BannedList';
import { Dialog } from '../components/Dialog';
import { InviteDialog } from '../components/InviteDialog';
import { Button as PrimaryButton } from '../components/ui/button';
import { Dialog as InviteModal, DialogContent } from '../components/ui/dialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { useNotify } from '../hooks/use-notify';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/format';
import { CharactersSection } from './campaign/CharactersSection';
import { CombatSection } from './campaign/CombatSection';
import { encountersQuery } from '../lib/combat-cache';
import { DiceRoller } from './campaign/DiceRoller';
import { SessionFeed } from './campaign/SessionFeed';
import { dialogActions, memberRow, page, sectionHeading, stack } from '../components/layout-styles';
import { cn } from '../lib/utils';

const rosterRow = 'col-span-full grid grid-cols-subgrid @max-[480px]:grid-cols-[40px_minmax(0,1fr)] [&>[data-slot=badge]]:col-start-3 [&>[data-slot=badge]]:justify-self-start [&>button]:col-start-4 [&>button]:justify-self-start @max-[480px]:[&>[data-slot=badge]]:col-start-2 @max-[480px]:[&>button]:col-start-2';

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

function InviteDialogHost({
  campaignId,
  campaignName,
  inviteCode,
  open,
  onOpenChange,
}: {
  campaignId: string;
  campaignName: string;
  inviteCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const rotate = useMutation({
    mutationFn: () => api.rotateInvite(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });

  return (
    <InviteModal open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <InviteDialog
          link={window.location.origin + invitePath(inviteCode)}
          code={inviteCode}
          campaignName={campaignName}
          onRotate={() => rotate.mutate()}
          rotating={rotate.isPending}
          rotateError={rotate.isError ? errorMessage(rotate.error) : undefined}
        />
      </DialogContent>
    </InviteModal>
  );
}

function InviteButton({ onClick, variant }: { onClick: () => void; variant?: 'secondary' }) {
  return (
    <PrimaryButton variant={variant} onClick={onClick}>
      <Plus size={18} aria-hidden="true" />
      Convidar jogadores
    </PrimaryButton>
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

/** The roster, the invite and the footnote, inside the admin disclosure. */
function MembersPanel({
  campaignId,
  isMaster,
  campaign,
  members,
  open,
  onToggle,
  onRemoved,
  onInvite,
}: {
  campaignId: string;
  isMaster: boolean;
  campaign: CampaignDetail | undefined;
  members: UseQueryResult<MembersResponse>;
  open: boolean;
  onToggle: (open: boolean) => void;
  onRemoved: () => void;
  onInvite: () => void;
}) {
  return (
    <div data-slot="campaign-admin" className="min-w-0 [grid-area:admin]">
      <details
        className="group/admin"
        open={open}
        onToggle={(event) => onToggle(event.currentTarget.open)}
      >
        <summary className={cn(sectionHeading, 'mb-0 cursor-pointer list-none rounded-control group-open/admin:mb-4 [&::-webkit-details-marker]:hidden')}>
          <h2 id="members-title">
            <Users size={20} aria-hidden="true" />
            Membros e convite
            <CaretRight size={14} aria-hidden="true" className="text-text-muted transition-transform duration-(--duration-quick) ease-settle group-open/admin:rotate-90" />
          </h2>
          <span>{members.isSuccess ? `${members.data.members.length} na mesa` : 'Carregando…'}</span>
        </summary>

        <section className="grid min-w-0 gap-4" aria-labelledby="members-title">
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
                action={campaign?.inviteCode ? <InviteButton variant="secondary" onClick={onInvite} /> : null}
              />
            )}
          </Surface>

          {isMaster && <BannedSection campaignId={campaignId} />}

          <p className="mt-3 text-small text-text-muted">
            {isMaster
              ? 'Você é o mestre desta campanha e gerencia quem participa.'
              : 'O mestre gerencia os convites e os membros desta campanha.'}
          </p>
        </section>
      </details>
    </div>
  );
}

function CampaignHeader({ campaign, campaignId, isMaster, onInvite }: {
  campaign: UseQueryResult<CampaignDetail>;
  campaignId: string;
  isMaster: boolean;
  onInvite: () => void;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-6 max-[479px]:gap-4 [&_h1]:mt-2 [&_h1]:font-display [&_h1]:text-display [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] @max-[480px]:[&_h1]:text-h1">
      <div className="min-w-0">
        <Link to="/campaigns" className="inline-flex min-h-8 items-center gap-1 text-small text-text-secondary no-underline transition-colors duration-(--duration-quick) hover:text-foreground">
          <ArrowLeft size={16} aria-hidden="true" />
          Suas campanhas
        </Link>
        <h1>{campaign.data?.name ?? 'Carregando…'}</h1>
        {campaign.data?.description && <p className="mt-2 text-text-secondary">{campaign.data.description}</p>}
      </div>
      {!campaign.isPending && !isMaster && <LeaveCampaign campaignId={campaignId} />}
      {isMaster && campaign.data?.inviteCode && <InviteButton onClick={onInvite} />}
    </header>
  );
}

function CampaignError({ error }: { error: Error }) {
  return (
    <main data-slot="page" className={cn(page, 'mx-auto w-full max-w-[1400px]')}>
      <Link to="/campaigns" className="inline-flex min-h-8 items-center gap-1 text-small text-text-secondary no-underline transition-colors duration-(--duration-quick) hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Suas campanhas
      </Link>
      <Surface>
        <p role="alert" className="text-body text-danger-text">
          {errorMessage(error)}
        </p>
      </Surface>
    </main>
  );
}

export function Campaign({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  // `null` means "not decided by hand yet": an empty table opens the panel,
  // because the invite is the whole point until someone joins.
  const [adminOpen, setAdminOpen] = useState<boolean | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  // The auth guard already cached `/api/auth/me`; this reads it without a
  // round trip and without importing the route object (which would be a
  // circular dependency with the router).
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });

  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.campaign(campaignId),
  });
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.members(campaignId),
  });
  // A player's list holds only active and ended fights, never one in preparation.
  const encounters = useQuery(encountersQuery(campaignId));

  const onRemoved = () => {
    notify({ variant: 'success', title: 'Jogador removido', description: 'A lista de membros foi atualizada.' });
    queryClient.invalidateQueries({ queryKey: ['members', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'bans'] });
  };

  if (campaign.isError) return <CampaignError error={campaign.error} />;

  const isMaster = campaign.data?.role === 'master';
  const tableIsEmpty = members.isSuccess && members.data.members.length <= 1;

  return (
    <main data-slot="page" className={cn(page, 'mx-auto w-full max-w-[1400px]')}>
      <CampaignHeader campaign={campaign} isMaster={isMaster} campaignId={campaignId} onInvite={() => setInviteOpen(true)} />

      {/* Order matters more than columns here: on a phone the table (dice and
          session) has to come before the administration of the campaign. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 [grid-template-areas:'characters'_'table'_'admin'] @min-[1000px]:grid-cols-[minmax(0,1fr)_320px] @min-[1000px]:grid-rows-[auto_1fr] @min-[1000px]:items-start @min-[1000px]:[grid-template-areas:'characters_table'_'admin_table']">
        <div className="grid min-w-0 gap-8 [grid-area:characters]">
          <CharactersSection
            campaignId={campaignId}
            currentUserId={me.data?.user.id ?? ''}
            isMaster={isMaster}
          />
          {/* The master always has combat (encounters and bestiary); a player
              only once a fight has started. */}
          {(isMaster || (encounters.data?.encounters.length ?? 0) > 0) && (
            <CombatSection campaignId={campaignId} isMaster={isMaster} currentUserId={me.data?.user.id ?? ''} />
          )}
        </div>

        <aside className="grid min-w-0 content-start gap-6 [grid-area:table]" aria-label="Mesa">
          <DiceRoller campaignId={campaignId} isMaster={isMaster} />
          <SessionFeed campaignId={campaignId} />
        </aside>

        <MembersPanel
          campaignId={campaignId}
          isMaster={isMaster}
          campaign={campaign.data}
          members={members}
          open={adminOpen ?? tableIsEmpty}
          onToggle={setAdminOpen}
          onRemoved={onRemoved}
          onInvite={() => setInviteOpen(true)}
        />
      </div>

      {isMaster && campaign.data?.inviteCode && (
        <InviteDialogHost
          campaignId={campaignId}
          campaignName={campaign.data.name}
          inviteCode={campaign.data.inviteCode}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}

    </main>
  );
}
