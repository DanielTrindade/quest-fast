import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { PAPEIS } from '@quest-fast/shared';

/**
 * Fase 0 do MVP. As tabelas de personagem, combate e mundo entram nas fases
 * seguintes; o schema cresce por migração, nunca por edição retroativa.
 */

const agora = sql`(unixepoch())`;

/** Perfil vem do Discord e é atualizado a cada login. Não editamos aqui. */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    discordId: text('discord_id').notNull(),
    nome: text('nome').notNull(),
    avatarUrl: text('avatar_url'),
    criadoEm: integer('criado_em', { mode: 'timestamp' }).notNull().default(agora),
    atualizadoEm: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(agora),
  },
  (table) => [uniqueIndex('users_discord_id_idx').on(table.discordId)],
);

/**
 * Sessão vive no servidor para que o logout possa invalidá-la de verdade; o
 * cookie carrega apenas o id.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    criadaEm: integer('criada_em', { mode: 'timestamp' }).notNull().default(agora),
    expiraEm: integer('expira_em', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    descricao: text('descricao').notNull().default(''),
    /** Visível apenas ao mestre; a rota de leitura omite para jogador. */
    codigoConvite: text('codigo_convite').notNull(),
    criadaEm: integer('criada_em', { mode: 'timestamp' }).notNull().default(agora),
  },
  (table) => [uniqueIndex('campaigns_codigo_convite_idx').on(table.codigoConvite)],
);

/**
 * Fonte única de autorização: toda rota de campanha resolve o papel aqui.
 * O par (campanha, usuário) é único — não existe participação duplicada.
 */
export const campaignMembers = sqliteTable(
  'campaign_members',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    papel: text('papel', { enum: PAPEIS }).notNull(),
    entrouEm: integer('entrou_em', { mode: 'timestamp' }).notNull().default(agora),
  },
  (table) => [
    uniqueIndex('campaign_members_campanha_usuario_idx').on(table.campaignId, table.userId),
    index('campaign_members_user_id_idx').on(table.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type NovoUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignMember = typeof campaignMembers.$inferSelect;
