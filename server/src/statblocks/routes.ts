import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { statblocks, type Db, type StatblockRow } from '@quest-fast/db';
import {
  ABILITIES,
  CHARACTER_LIMITS as L,
  STATBLOCK_LIMITS as S,
  isChallengeRating,
  isSize,
  parseDiceExpression,
  type AbilityScores,
  type Statblock,
  type StatblockSummary,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { boundedInteger, fail, isInputError, parseAttack, shortText, withInput } from '../validation.ts';

type StatblockColumns = Omit<StatblockRow, 'id' | 'campaignId' | 'createdAt' | 'updatedAt'>;

/** Absent or empty text becomes ''; anything else must fit the limit. */
function optionalText(value: unknown, limit: number, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > limit) fail(`${label} deve ter até ${limit} caracteres.`);
  return value.trim();
}

function parseAbilityScores(value: unknown): AbilityScores {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const scores = {} as AbilityScores;
  for (const ability of ABILITIES) {
    const score = boundedInteger(source[ability], L.abilityScore.min, L.abilityScore.max);
    if (score === undefined) {
      fail(`Atributos devem ser números entre ${L.abilityScore.min} e ${L.abilityScore.max}.`);
    }
    scores[ability] = score;
  }
  return scores;
}

/**
 * The editor always sends the whole statblock, on create and on edit, so a
 * missing optional field means its default, never "keep the stored value".
 */
function parseStatblockInput(body: unknown): StatblockColumns {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const name = shortText(source.name, S.name);
  if (!name) fail(`Informe o nome da criatura, com até ${S.name} caracteres.`);

  const size = source.size ?? 'medium';
  if (!isSize(size)) fail('Tamanho inválido.');

  const challengeRating = source.challengeRating ?? '';
  if (challengeRating !== '' && !isChallengeRating(challengeRating)) {
    fail('ND deve ser 0, 1/8, 1/4, 1/2 ou um número de 1 a 30.');
  }

  const ac = boundedInteger(source.ac, S.ac.min, S.ac.max);
  if (ac === undefined) fail(`CA deve ser um número entre ${S.ac.min} e ${S.ac.max}.`);
  const hpAverage = boundedInteger(source.hpAverage, S.hp.min, S.hp.max);
  if (hpAverage === undefined) fail(`PV deve ser um número entre ${S.hp.min} e ${S.hp.max}.`);

  const hpFormula = optionalText(source.hpFormula, S.hpFormula, 'A fórmula de PV');
  // A typo in the formula would only show up when the encounter rolls it.
  if (hpFormula !== '' && !parseDiceExpression(hpFormula)) {
    fail('A fórmula de PV deve ser uma expressão de dados (ex.: 2d8+2).');
  }

  const initiativeBonus =
    source.initiativeBonus === undefined
      ? 0
      : boundedInteger(source.initiativeBonus, S.initiativeBonus.min, S.initiativeBonus.max);
  if (initiativeBonus === undefined) {
    fail(`O bônus de iniciativa deve ser um número entre ${S.initiativeBonus.min} e ${S.initiativeBonus.max}.`);
  }

  const attacksInput = source.attacks ?? [];
  if (!Array.isArray(attacksInput) || attacksInput.length > S.attacks) fail(`Limite de ${S.attacks} ataques.`);
  const attacks = attacksInput.map((raw) => {
    const attack = parseAttack(raw);
    if (!attack) fail('Ataque inválido: nome, bônus e dano (expressão como 1d8+3).');
    return attack;
  });

  return {
    name,
    size,
    creatureType: optionalText(source.creatureType, S.creatureType, 'O tipo da criatura'),
    challengeRating: challengeRating as string,
    ac,
    hpAverage,
    hpFormula,
    speed: optionalText(source.speed, S.speed, 'O deslocamento'),
    initiativeBonus,
    abilityScores: parseAbilityScores(source.abilityScores),
    attacks,
    traits: optionalText(source.traits, S.text, 'Os traços'),
    actions: optionalText(source.actions, S.text, 'As ações'),
    reactions: optionalText(source.reactions, S.text, 'As reações'),
  };
}

function toStatblock(row: StatblockRow): Statblock {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function findStatblock(db: Db, campaignId: string, statblockId: string) {
  return db
    .select()
    .from(statblocks)
    .where(and(eq(statblocks.id, statblockId), eq(statblocks.campaignId, campaignId)))
    .get();
}

/** The bestiary belongs to the master: a player gets 403, a non-member 404. */
export function statblockRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth, requireCampaignRole('master'));

  routes.get('/', (c) => {
    const { db } = c.var.deps;
    const rows: StatblockSummary[] = db
      .select({
        id: statblocks.id,
        name: statblocks.name,
        size: statblocks.size,
        creatureType: statblocks.creatureType,
        challengeRating: statblocks.challengeRating,
        ac: statblocks.ac,
        hpAverage: statblocks.hpAverage,
      })
      .from(statblocks)
      .where(eq(statblocks.campaignId, c.var.campaignId))
      .orderBy(asc(sql`${statblocks.name} COLLATE NOCASE`), asc(statblocks.id))
      .all();
    return c.json({ statblocks: rows });
  });

  routes.post('/', async (c) => {
    const { db } = c.var.deps;
    const body = await c.req.json().catch(() => ({}));
    const result = await withInput(() =>
      db
        .insert(statblocks)
        .values({ id: randomUUID(), campaignId: c.var.campaignId, ...parseStatblockInput(body) })
        .returning()
        .get(),
    );
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);
    return c.json({ statblock: toStatblock(result) }, 201);
  });

  routes.get('/:statblockId', (c) => {
    const row = findStatblock(c.var.deps.db, c.var.campaignId, c.req.param('statblockId'));
    if (!row) return c.json({ error: 'Criatura não encontrada.' }, 404);
    return c.json({ statblock: toStatblock(row) });
  });

  routes.patch('/:statblockId', async (c) => {
    const { db } = c.var.deps;
    const row = findStatblock(db, c.var.campaignId, c.req.param('statblockId'));
    if (!row) return c.json({ error: 'Criatura não encontrada.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const result = await withInput(() =>
      db
        .update(statblocks)
        .set({ ...parseStatblockInput(body), updatedAt: new Date() })
        .where(eq(statblocks.id, row.id))
        .returning()
        // The row was found above, inside the same request.
        .get()!,
    );
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);
    return c.json({ statblock: toStatblock(result) });
  });

  routes.delete('/:statblockId', (c) => {
    const { db } = c.var.deps;
    const row = findStatblock(db, c.var.campaignId, c.req.param('statblockId'));
    if (!row) return c.json({ error: 'Criatura não encontrada.' }, 404);
    db.delete(statblocks).where(eq(statblocks.id, row.id)).run();
    return c.body(null, 204);
  });

  return routes;
}
