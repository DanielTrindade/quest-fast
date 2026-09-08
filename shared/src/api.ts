import type { Role } from './role.ts';

/**
 * Contract between server and client. Dates travel as ISO 8601; formatting
 * for the table is the client's decision.
 */

export type ErrorResponse = { error: string };

export type PublicUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CampaignSummary = {
  id: string;
  name: string;
  description: string;
  role: Role;
  joinedAt: string;
};

/** `inviteCode` is only present when the reader is the master. */
export type CampaignDetail = {
  id: string;
  name: string;
  description: string;
  role: Role;
  inviteCode?: string;
};

export type CreatedCampaign = CampaignDetail & { inviteCode: string };

export type CampaignJoin = {
  id: string;
  name: string;
  role: Role;
};

export type CampaignMember = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
};

export type MeResponse = { user: PublicUser };
export type CampaignsResponse = { campaigns: CampaignSummary[] };
export type MembersResponse = { members: CampaignMember[] };
