import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '../../lib/api';

/** Visible copy stays in Portuguese — it is what the table reads. */
export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

/**
 * What every campaign screen needs: the campaign, the viewer's role and id.
 * The auth guard already cached `/api/auth/me`, so reading it costs no round
 * trip and needs no import of the route object (a cycle with the router).
 */
export function useCampaignScreen(campaignId: string) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.campaign(campaignId),
  });
  return { campaign, isMaster: campaign.data?.role === 'master', currentUserId: me.data?.user.id ?? '' };
}
