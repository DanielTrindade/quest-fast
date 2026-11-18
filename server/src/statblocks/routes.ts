import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { assets, statblocks, type Db, type StatblockRow } from '@quest-fast/db';
import {
  ABILITIES,
  CHARACTER_LIMITS as L,
  STATBLOCK_LIMITS as S,
  TURN_LIMITS,
  isAttacksPerAction,
  isChallengeRating,
  isSize,
  isAbility,
  parseDiceExpression,
  storedAttack,
  type AbilityScores,
  type SaveBonuses,
  type Statblock,
  type StatblockSummary,
} from '@quest-fast/shared';
import type { AssetStore } from '../assets/store.ts';
import type { Context } from '../context.ts';
import { bumpScenes, publishScenes, scenesShowing } from '../scenes/store.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { boundedInteger, fail, isInputError, parseAttack, shortText, withInput } from '../validation.ts';

type StatblockColumns = Omit<StatblockRow, 'id' | 'campaignId' | 'createdAt' | 'updatedAt' | 'attacksPerAction' | 'imageAssetId' | 'saveBonuses'> & {
  attacksPerAction?: number;
  /** Absent keeps the stored ones; a new entry has none. */
  saveBonuses?: SaveBonuses;
  /** Absent keeps the image; null removes it. */
  imageAssetId?: string | null;
};

/** The image must be an asset of this campaign, uploaded through `/assets`. */
function parseImage(db: Db, campaignId: string, value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || value.length === 0) fail('Imagem da criatura inválida.');
  const asset = db.select({ campaignId: assets.campaignId }).from(assets).where(eq(assets.id, value)).get();
  if (!asset || asset.campaignId !== campaignId) fail('Imagem da criatura inválida.');
  return value;
}

/** Absent or empty text becomes ''; anything else must fit the limit. */
function optionalText(value: unknown, limit: number, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > limit) fail(`${label} deve ter até ${limit} caracteres.`);
  return value.trim();
}

/** Only the proficient saves, each with its bonus in range. */
function parseSaveBonuses(value: unknown): SaveBonuses | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('Salvaguardas inválidas.');
  const bonuses: SaveBonuses = {};
  for (const [ability, raw] of Object.entries(value)) {
    const bonus = boundedInteger(raw, S.saveBonus.min, S.saveBonus.max);
    if (!isAbility(ability) || bonus === undefined) {
      fail(`O bônus de salvaguarda deve ser um número entre ${S.saveBonus.min} e ${S.saveBonus.max}.`);
    }
    bonuses[ability] = bonus;
  }
  return bonuses;
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
function parseStatblockInput(db: Db, campaignId: string, body: unknown): StatblockColumns {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const imageAssetId = parseImage(db, campaignId, source.imageAssetId);

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

  // Absent keeps what is stored on an edit; a new entry takes the column's default, 1.
  const { attacksPerAction } = source;
  if (attacksPerAction !== undefined && !isAttacksPerAction(attacksPerAction)) {
    fail(`Ataques por ação deve ser um número entre ${TURN_LIMITS.attacksPerAction.min} e ${TURN_LIMITS.attacksPerAction.max}.`);
  }

  const attacksInput = source.attacks ?? [];
  if (!Array.isArray(attacksInput) || attacksInput.length > S.attacks) fail(`Limite de ${S.attacks} ataques.`);
  const attacks = attacksInput.map((raw) => {
    const attack = parseAttack(raw);
    if (!attack) fail('Ataque inválido: nome, bônus e dano (expressão como 1d8+3).');
    return attack;
  });
  const saveBonuses = parseSaveBonuses(source.saveBonuses);

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
    ...(attacksPerAction === undefined ? {} : { attacksPerAction: attacksPerAction as number }),
    ...(saveBonuses === undefined ? {} : { saveBonuses }),
    ...(imageAssetId === undefined ? {} : { imageAssetId }),
  };
}

function imagePath(db: Db, assetId: string | null): string | null {
  if (!assetId) return null;
  return db.select({ path: assets.path }).from(assets).where(eq(assets.id, assetId)).get()?.path ?? null;
}

function toStatblock(db: Db, store: AssetStore, row: StatblockRow): Statblock {
  const path = imagePath(db, row.imageAssetId);
  return {
    ...row,
    attacks: row.attacks.map(storedAttack),
    imageUrl: path ? store.urlFor(path) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The tokens of this entry show its image: the scenes with them are told of a new one. */
function publishStatblockScenes(c: { var: Context['Variables'] }, statblockId: string) {
  const { deps, campaignId } = c.var;
  const shown = deps.db.transaction((tx) => {
    const ids = scenesShowing(tx, { statblockId });
    bumpScenes(tx, ids);
    return ids;
  });
  publishScenes(deps, campaignId, shown);
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
        hpFormula: statblocks.hpFormula,
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
        .values({ id: randomUUID(), campaignId: c.var.campaignId, ...parseStatblockInput(db, c.var.campaignId, body) })
        .returning()
        .get(),
    );
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);
    return c.json({ statblock: toStatblock(db, c.var.deps.assets, result) }, 201);
  });

  routes.get('/:statblockId', (c) => {
    const row = findStatblock(c.var.deps.db, c.var.campaignId, c.req.param('statblockId'));
    if (!row) return c.json({ error: 'Criatura não encontrada.' }, 404);
    return c.json({ statblock: toStatblock(c.var.deps.db, c.var.deps.assets, row) });
  });

  routes.patch('/:statblockId', async (c) => {
    const { db } = c.var.deps;
    const row = findStatblock(db, c.var.campaignId, c.req.param('statblockId'));
    if (!row) return c.json({ error: 'Criatura não encontrada.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const result = await withInput(() =>
      db
        .update(statblocks)
        .set({ ...parseStatblockInput(db, c.var.campaignId, body), updatedAt: new Date() })
        .where(eq(statblocks.id, row.id))
        .returning()
        // The row was found above, inside the same request.
        .get()!,
    );
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);
    if (result.imageAssetId !== row.imageAssetId) publishStatblockScenes(c, row.id);
    return c.json({ statblock: toStatblock(db, c.var.deps.assets, result) });
  });

  routes.delete('/:statblockId', (c) => {
    const { db } = c.var.deps;
    const row = findStatblock(db, c.var.campaignId, c.req.param('statblockId'));
    if (!row) return c.json({ error: 'Criatura não encontrada.' }, 404);
    // Its tokens lose the image with the link: the scenes showing them are
    // read before the delete clears it, bumped with it and told after.
    const shown = db.transaction((tx) => {
      const ids = scenesShowing(tx, { statblockId: row.id });
      tx.delete(statblocks).where(eq(statblocks.id, row.id)).run();
      bumpScenes(tx, ids);
      return ids;
    });
    publishScenes(c.var.deps, c.var.campaignId, shown);
    return c.body(null, 204);
  });

  return routes;
}
