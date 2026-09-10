import type {
  AssetUploadResponse,
  CampaignDetail,
  CampaignJoin,
  CampaignsResponse,
  CharacterInput,
  CharacterListResponse,
  CharacterResponse,
  CreatedCampaign,
  FeedResponse,
  FreeRollRequest,
  LinkedRollRequest,
  MeResponse,
  MembersResponse,
  RollResponse,
} from '@quest-fast/shared';

/**
 * API client. The server is the source of truth: there is no role or
 * visibility computation here, only transport and error translation.
 */

export class ApiError extends Error {
  // Field declared and assigned in the body: `erasableSyntaxOnly` forbids
  // parameter properties, which would require a type-driven transform.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  /** Missing or expired session: the app should return to the login screen. */
  get unauthenticated() {
    return this.status === 401;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A FormData body carries its own multipart boundary; forcing the JSON
  // header would break the parser on the server.
  const isFormData = init.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { ...(isFormData ? {} : { 'content-type': 'application/json' }), ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    // A server error arrives as { error }. A network failure or a proxy's HTML
    // does not, and must not turn into "undefined" on screen. The fallback is
    // player-facing text, so it stays in Portuguese.
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'Não foi possível falar com o servidor.';
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  me: () => request<MeResponse>('/api/auth/me'),
  signOut: () => request<void>('/api/auth/logout', { method: 'POST' }),

  campaigns: () => request<CampaignsResponse>('/api/campaigns'),

  createCampaign: (name: string, description: string) =>
    request<CreatedCampaign>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  joinCampaign: (code: string) =>
    request<CampaignJoin>('/api/campaigns/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  campaign: (id: string) => request<CampaignDetail>(`/api/campaigns/${id}`),
  members: (id: string) => request<MembersResponse>(`/api/campaigns/${id}/members`),

  leaveCampaign: (id: string) => request<void>(`/api/campaigns/${id}/members/me`, { method: 'DELETE' }),

  removeMember: (campaignId: string, memberId: string) =>
    request<void>(`/api/campaigns/${campaignId}/members/${memberId}`, { method: 'DELETE' }),

  characters: (campaignId: string) => request<CharacterListResponse>(`/api/campaigns/${campaignId}/characters`),
  character: (campaignId: string, characterId: string) =>
    request<CharacterResponse>(`/api/campaigns/${campaignId}/characters/${characterId}`),
  createCharacter: (campaignId: string, input: CharacterInput) =>
    request<CharacterResponse>(`/api/campaigns/${campaignId}/characters`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCharacter: (campaignId: string, characterId: string, input: CharacterInput) =>
    request<CharacterResponse>(`/api/campaigns/${campaignId}/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteCharacter: (campaignId: string, characterId: string) =>
    request<void>(`/api/campaigns/${campaignId}/characters/${characterId}`, { method: 'DELETE' }),

  uploadAsset: (campaignId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<AssetUploadResponse>(`/api/campaigns/${campaignId}/assets`, { method: 'POST', body: form });
  },

  feed: (campaignId: string) => request<FeedResponse>(`/api/campaigns/${campaignId}/feed`),

  roll: (campaignId: string, body: FreeRollRequest) =>
    request<RollResponse>(`/api/campaigns/${campaignId}/rolls`, { method: 'POST', body: JSON.stringify(body) }),
  characterRoll: (campaignId: string, characterId: string, body: LinkedRollRequest) =>
    request<RollResponse>(`/api/campaigns/${campaignId}/characters/${characterId}/rolls`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

/** Login leaves the SPA: Discord answers the server, not the client. */
export const LOGIN_PATH = '/api/auth/discord';
