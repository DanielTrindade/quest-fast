import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { invitePath, normalizeInviteCode } from '@quest-fast/shared';
import { InvitePanel } from '../components/InvitePanel';
import { ApiError, api, loginHref } from '../lib/api';
import { clearJoinMarker, readJoinMarker, setJoinMarker } from '../lib/join-marker';

function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
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

  useEffect(() => {
    if (!join) return;
    clearJoinMarker();
    navigate({ to: '.', search: (previous) => ({ ...previous, join: undefined }), replace: true });
  }, [join, navigate]);

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

  const joinForbidden = joinMutation.error instanceof ApiError && joinMutation.error.status === 403;
  const joinGone = isNotFound(joinMutation.error);
  const joinError = joinMutation.isError && !joinForbidden && !joinGone
    ? joinMutation.error instanceof ApiError ? joinMutation.error.message : 'Algo deu errado. Tente novamente.'
    : undefined;

  let state: 'loading' | 'anonymous' | 'guest' | 'blocked' | 'invalid' | 'error' = 'loading';
  if (isNotFound(invite.error) || joinGone) state = 'invalid';
  else if (invite.isError) state = 'error';
  else if (joinForbidden || viewer === 'blocked') state = 'blocked';
  else if (viewer === 'anonymous') state = 'anonymous';
  else if (viewer === 'guest') state = 'guest';

  return (
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
  );
}
