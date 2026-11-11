import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { invitePath, normalizeInviteCode, type InvitePreview } from '@quest-fast/shared';
import { InvitePanel } from '../components/InvitePanel';
import { ApiError, api, loginHref } from '../lib/api';
import { clearJoinMarker, readJoinMarker, setJoinMarker } from '../lib/join-marker';

function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

type PanelState = ComponentProps<typeof InvitePanel>['state'];

function describe(
  invite: UseQueryResult<InvitePreview>,
  join: UseMutationResult<unknown, Error, void>,
): { state: PanelState; joinError: string | undefined } {
  const forbidden = join.error instanceof ApiError && join.error.status === 403;
  const gone = isNotFound(join.error);
  const viewer = invite.data?.viewer;
  let joinError: string | undefined;
  if (join.isError && !forbidden && !gone) {
    joinError = join.error instanceof ApiError ? join.error.message : 'Algo deu errado. Tente novamente.';
  }
  if (isNotFound(invite.error) || gone) return { state: 'invalid', joinError };
  if (invite.isError) return { state: 'error', joinError };
  if (forbidden || viewer === 'blocked') return { state: 'blocked', joinError };
  if (viewer === 'anonymous' || viewer === 'guest') return { state: viewer, joinError };
  return { state: 'loading', joinError };
}

export function Invite({ code, join, failed }: { code: string; join: boolean; failed: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const normalized = normalizeInviteCode(code) ?? code;
  const invite = useQuery({
    queryKey: ['invite', code],
    queryFn: () => api.invite(code),
    retry: (count, error) => !isNotFound(error) && count < 2,
  });
  const joinMutation = useMutation({
    mutationFn: () => api.joinCampaign(code),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['invite', code] });
      navigate({ to: '/campaigns/$campaignId', params: { campaignId: campaign.id }, replace: true });
    },
  });

  // `?join=1` is forgeable, so it only counts when this browser set the marker
  // by clicking the login button for this same code.
  const [autoJoin] = useState(() => join && readJoinMarker() === normalized);

  useEffect(clearJoinMarker, []);

  const viewer = invite.data?.viewer;
  const memberCampaignId = viewer === 'member' ? invite.data?.campaignId : undefined;
  const autoJoined = useRef(false);
  const { mutate: joinCampaign } = joinMutation;

  useEffect(() => {
    if (memberCampaignId) {
      navigate({ to: '/campaigns/$campaignId', params: { campaignId: memberCampaignId }, replace: true });
    }
  }, [memberCampaignId, navigate]);

  useEffect(() => {
    if (autoJoin && viewer === 'guest' && !autoJoined.current) {
      autoJoined.current = true;
      joinCampaign();
    }
  }, [autoJoin, viewer, joinCampaign]);

  const { state, joinError } = describe(invite, joinMutation);

  return (
    <>
      {join && <Navigate to="." search={(previous) => ({ ...previous, join: undefined })} replace />}
      <InvitePanel
        state={state}
        invite={invite.data}
        loginHref={loginHref(`${invitePath(code)}?join=1`)}
        campaignsHref="/campaigns"
        failed={failed}
        onJoin={() => joinCampaign()}
        joining={joinMutation.isPending}
        joinError={joinError}
        onLoginClick={() => setJoinMarker(normalized)}
        onRetry={() => invite.refetch()}
      />
    </>
  );
}
