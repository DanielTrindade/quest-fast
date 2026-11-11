import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { invitePath } from '@quest-fast/shared';
import { InvitePanel } from '../components/InvitePanel';
import { ApiError, api, loginHref } from '../lib/api';

export function Invite({ code, join, failed }: { code: string; join: boolean; failed: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invite = useQuery({
    queryKey: ['invite', code],
    queryFn: () => api.invite(code),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const joinMutation = useMutation({
    mutationFn: () => api.joinCampaign(code),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate({ to: '/campaigns/$campaignId', params: { campaignId: campaign.id }, replace: true });
    },
  });

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
    if (join && viewer === 'guest' && !autoJoined.current) {
      autoJoined.current = true;
      joinCampaign();
    }
  }, [join, viewer, joinCampaign]);

  const joinForbidden = joinMutation.error instanceof ApiError && joinMutation.error.status === 403;
  const joinError = joinMutation.isError && !joinForbidden
    ? joinMutation.error instanceof ApiError ? joinMutation.error.message : 'Algo deu errado. Tente novamente.'
    : undefined;

  let state: 'loading' | 'anonymous' | 'guest' | 'blocked' | 'invalid' = 'loading';
  if (invite.error instanceof ApiError && invite.error.status === 404) state = 'invalid';
  else if (joinForbidden || viewer === 'blocked') state = 'blocked';
  else if (viewer === 'anonymous') state = 'anonymous';
  else if (viewer === 'guest') state = 'guest';

  return (
    <InvitePanel
      state={state}
      invite={invite.data}
      loginHref={loginHref(`${invitePath(code)}?join=1`)}
      // A plain anchor: an anonymous or blocked visitor has no SPA session to keep.
      campaignsHref="/campaigns"
      failed={failed}
      onJoin={() => joinCampaign()}
      joining={joinMutation.isPending}
      joinError={joinError}
    />
  );
}
