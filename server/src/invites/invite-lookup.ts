import { and, eq, sql } from 'drizzle-orm';
import { campaignMembers, campaigns, users, type Db } from '@quest-fast/db';
import { normalizeInviteCode } from '@quest-fast/shared';

export type InviteRecord = {
  campaignId: string;
  code: string;
  campaignName: string;
  masterName: string;
  masterAvatarUrl: string | null;
  playerCount: number;
};

export function findInvite(db: Db, rawCode: string): InviteRecord | undefined {
  const code = normalizeInviteCode(rawCode);
  if (!code) return undefined;

  return db
    .select({
      campaignId: campaigns.id,
      code: campaigns.inviteCode,
      campaignName: campaigns.name,
      masterName: users.name,
      masterAvatarUrl: users.avatarUrl,
      playerCount: sql<number>`(select count(*) from ${campaignMembers} as players where players.campaign_id = ${campaigns.id} and players.role = 'player')`.mapWith(Number),
    })
    .from(campaigns)
    .innerJoin(campaignMembers, and(eq(campaignMembers.campaignId, campaigns.id), eq(campaignMembers.role, 'master')))
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .where(eq(campaigns.inviteCode, code))
    .get();
}
