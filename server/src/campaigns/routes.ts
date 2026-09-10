import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { campaignMembers, campaigns, users, type Db } from '@quest-fast/db';
import { generateInviteCode, normalizeInviteCode } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';

const NAME_LIMIT = 80;
const DESCRIPTION_LIMIT = 500;

/**
 * The code is unique by index in the database. A collision is unlikely, but
 * the retry keeps creation deterministic instead of erroring at the master.
 * The campaign and its master membership are one write: a failure while adding
 * the member must not leave a masterless campaign behind.
 */
function createCampaignWithCode(db: Db, name: string, description: string, creatorId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      return db.transaction((tx) => {
        const campaign = tx
          .insert(campaigns)
          .values({ id: randomUUID(), name, description, inviteCode: code })
          .returning()
          .get();
        tx.insert(campaignMembers)
          .values({ id: randomUUID(), campaignId: campaign.id, userId: creatorId, role: 'master' })
          .run();
        return campaign;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('UNIQUE') || attempt === 4) throw error;
    }
  }
  throw new Error('Could not generate a unique invite code.');
}

function validText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean.length > 0 && clean.length <= limit ? clean : undefined;
}

// Error messages are player-facing, so they stay in Portuguese.
export function campaignRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth);

  routes.post('/', async (c) => {
    const { db } = c.var.deps;
    const body = await c.req.json().catch(() => ({}));
    const name = validText(body?.name, NAME_LIMIT);
    if (!name) return c.json({ error: `Informe um nome de até ${NAME_LIMIT} caracteres.` }, 422);

    const rawDescription = typeof body?.description === 'string' ? body.description.trim() : '';
    if (rawDescription.length > DESCRIPTION_LIMIT) {
      return c.json({ error: `A descrição deve ter até ${DESCRIPTION_LIMIT} caracteres.` }, 422);
    }

    const campaign = createCampaignWithCode(db, name, rawDescription, c.var.user.id);
    return c.json(
      {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        role: 'master',
        inviteCode: campaign.inviteCode,
      },
      201,
    );
  });

  routes.get('/', (c) => {
    const { db } = c.var.deps;
    const rows = db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        role: campaignMembers.role,
        joinedAt: campaignMembers.joinedAt,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(eq(campaignMembers.userId, c.var.user.id))
      .orderBy(desc(campaignMembers.joinedAt))
      .all();
    return c.json({ campaigns: rows });
  });

  routes.post('/join', async (c) => {
    const { db } = c.var.deps;
    const body = await c.req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? normalizeInviteCode(body.code) : undefined;
    if (!code) return c.json({ error: 'Código de convite inválido.' }, 422);

    const campaign = db.select().from(campaigns).where(eq(campaigns.inviteCode, code)).get();
    if (!campaign) return c.json({ error: 'Código de convite inválido.' }, 404);

    const alreadyMember = db
      .select({ role: campaignMembers.role })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaign.id), eq(campaignMembers.userId, c.var.user.id)))
      .get();

    // Rejoining with the same code leads to the campaign, without duplicating.
    if (alreadyMember) return c.json({ id: campaign.id, name: campaign.name, role: alreadyMember.role }, 200);

    db.insert(campaignMembers)
      .values({ id: randomUUID(), campaignId: campaign.id, userId: c.var.user.id, role: 'player' })
      .run();
    return c.json({ id: campaign.id, name: campaign.name, role: 'player' }, 201);
  });

  routes.get('/:campaignId', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const campaign = db.select().from(campaigns).where(eq(campaigns.id, c.var.campaignId)).get();
    if (!campaign) return c.json({ error: 'Campanha não encontrada.' }, 404);
    return c.json({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      role: c.var.role,
      // The code only exists in the master's response.
      ...(c.var.role === 'master' ? { inviteCode: campaign.inviteCode } : {}),
    });
  });

  routes.get('/:campaignId/members', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const members = db
      .select({
        id: campaignMembers.id,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: campaignMembers.role,
        joinedAt: campaignMembers.joinedAt,
      })
      .from(campaignMembers)
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(eq(campaignMembers.campaignId, c.var.campaignId))
      // Master first, then join order. Without the id tie-break, two members
      // who joined in the same second would come out in undefined order.
      .orderBy(
        sql`case ${campaignMembers.role} when 'master' then 0 else 1 end`,
        campaignMembers.joinedAt,
        campaignMembers.id,
      )
      .all();
    return c.json({ members });
  });

  routes.delete('/:campaignId/members/me', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    // Leaving would strand the campaign without a master; refuse.
    if (c.var.role === 'master') {
      return c.json({ error: 'O mestre não pode sair da própria campanha.' }, 409);
    }
    db.delete(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, c.var.campaignId), eq(campaignMembers.userId, c.var.user.id)))
      .run();
    return c.body(null, 204);
  });

  routes.delete('/:campaignId/members/:memberId', requireCampaignRole('master'), (c) => {
    const { db } = c.var.deps;
    const memberId = c.req.param('memberId');
    const target = db
      .select()
      .from(campaignMembers)
      .where(and(eq(campaignMembers.id, memberId), eq(campaignMembers.campaignId, c.var.campaignId)))
      .get();

    if (!target) return c.json({ error: 'Membro não encontrado.' }, 404);
    if (target.role === 'master') return c.json({ error: 'O mestre não pode ser removido.' }, 409);

    db.delete(campaignMembers).where(eq(campaignMembers.id, target.id)).run();
    return c.body(null, 204);
  });

  return routes;
}
