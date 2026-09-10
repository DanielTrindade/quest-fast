import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { assets, characters, users, type Db } from '@quest-fast/db';
import {
  ABILITIES,
  abilityModifier,
  isAbility,
  isSkill,
  parseDiceExpression,
  proficiencyBonus,
  rollDice,
  type Ability,
  type Attack,
  type CharacterInput,
  type CharacterSheet,
  type CharacterSummary,
  type LinkedRollRequest,
  type RollPayload,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { recordRollEvent } from '../events/feed.ts';

const NAME_LIMIT = 80;
const SHORT_TEXT_LIMIT = 60;
const DESCRIPTION_LIMIT = 2000;
const HP_MIN = 1;
const HP_MAX = 999;
const AC_MIN = 0;
const AC_MAX = 40;
const ATTACK_LIMIT = 10;
const ATTACK_BONUS_RANGE = 20;
const DAMAGE_LIMIT = 30;
const FEATURES_LIMIT = 30;
const FEATURE_LIMIT = 200;

// Error messages are player-facing, so they stay in Portuguese.
type ValidInput = { ok: true; value: CharacterInput } | { ok: false; error: string };

function boundedInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

function shortText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean.length > 0 && clean.length <= limit ? clean : undefined;
}

function uniqueStrings<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function parseAttack(value: unknown): Attack | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const attack = value as Record<string, unknown>;
  const name = shortText(attack.name, NAME_LIMIT);
  const bonus = boundedInteger(attack.bonus, -ATTACK_BONUS_RANGE, ATTACK_BONUS_RANGE);
  const damage = shortText(attack.damage, DAMAGE_LIMIT);
  if (!name || bonus === undefined || !damage) return undefined;
  // Damage is a dice expression: catching a typo now beats a wrong roll later.
  if (!parseDiceExpression(damage)) return undefined;
  return { name, bonus, damage };
}

/** Validates the whole sheet. Editing uses the same shape, so one parser. */
function parseCharacterInput(body: unknown): ValidInput {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const name = shortText(source.name, NAME_LIMIT);
  if (!name) return { ok: false, error: `Informe um nome de até ${NAME_LIMIT} caracteres.` };

  const race = shortText(source.race, SHORT_TEXT_LIMIT);
  const className = shortText(source.class, SHORT_TEXT_LIMIT);
  if (!race || !className) {
    return { ok: false, error: `Raça e classe são obrigatórias (até ${SHORT_TEXT_LIMIT} caracteres).` };
  }

  const level = boundedInteger(source.level, 1, 20);
  if (!level) return { ok: false, error: 'Nível deve ser um número entre 1 e 20.' };

  const rawScores = source.abilityScores;
  if (typeof rawScores !== 'object' || rawScores === null) {
    return { ok: false, error: 'Informe os seis atributos.' };
  }
  const scores = rawScores as Record<string, unknown>;
  const abilityScores = {} as Record<Ability, number>;
  for (const ability of ABILITIES) {
    const value = boundedInteger(scores[ability], 1, 30);
    if (!value) return { ok: false, error: 'Atributos devem ser números entre 1 e 30.' };
    abilityScores[ability] = value;
  }

  const hp = boundedInteger(source.hp, HP_MIN, HP_MAX);
  const ac = boundedInteger(source.ac, AC_MIN, AC_MAX);
  if (!hp || ac === undefined) {
    return { ok: false, error: 'HP e CA devem ser números dentro dos limites.' };
  }

  const skillsInput = Array.isArray(source.skills) ? source.skills : [];
  const skills = uniqueStrings(skillsInput).filter(isSkill);
  if (skillsInput.some((skill) => !isSkill(skill))) {
    return { ok: false, error: 'Perícia inválida.' };
  }

  const savesInput = Array.isArray(source.saves) ? source.saves : [];
  const saves = uniqueStrings(savesInput).filter(isAbility);
  if (savesInput.some((ability) => !isAbility(ability))) {
    return { ok: false, error: 'Teste de resistência inválido.' };
  }

  const attacksInput = Array.isArray(source.attacks) ? source.attacks : [];
  if (attacksInput.length > ATTACK_LIMIT) return { ok: false, error: `Limite de ${ATTACK_LIMIT} ataques.` };
  const attacks: Attack[] = [];
  for (const raw of attacksInput) {
    const attack = parseAttack(raw);
    if (!attack) return { ok: false, error: 'Ataque inválido: nome, bônus e dano (expressão como 1d8+3).' };
    attacks.push(attack);
  }

  const featuresInput = Array.isArray(source.features) ? source.features : [];
  if (featuresInput.length > FEATURES_LIMIT) {
    return { ok: false, error: `Limite de ${FEATURES_LIMIT} características.` };
  }
  const features: string[] = [];
  for (const feature of featuresInput) {
    // Refusing beats silently dropping: the master must not lose text on save.
    if (typeof feature !== 'string' || feature.length > FEATURE_LIMIT) {
      return { ok: false, error: `Cada característica deve ter até ${FEATURE_LIMIT} caracteres.` };
    }
    if (feature.length > 0) features.push(feature);
  }

  const rawDescription = typeof source.description === 'string' ? source.description : '';
  if (rawDescription.length > DESCRIPTION_LIMIT) {
    return { ok: false, error: `A descrição deve ter até ${DESCRIPTION_LIMIT} caracteres.` };
  }
  const description = rawDescription;
  const avatarAssetId =
    typeof source.avatarAssetId === 'string' && source.avatarAssetId.length > 0
      ? source.avatarAssetId
      : null;

  return {
    ok: true,
    value: {
      name,
      race,
      class: className,
      level,
      abilityScores,
      hp,
      ac,
      skills,
      saves,
      attacks,
      features: uniqueStrings(features),
      description,
      avatarAssetId,
    },
  };
}

function avatarUrl(path: string | null): string | null {
  return path ? `/uploads/${path}` : null;
}

function toSummary(row: {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  ownerId: string;
  ownerName: string;
  avatarPath: string | null;
}): CharacterSummary {
  return {
    id: row.id,
    name: row.name,
    race: row.race,
    class: row.class,
    level: row.level,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    avatarUrl: avatarUrl(row.avatarPath),
  };
}

function characterSelect(db: Db, campaignId: string, characterId: string) {
  return db
    .select({
      id: characters.id,
      campaignId: characters.campaignId,
      ownerId: characters.ownerId,
      ownerName: users.name,
      name: characters.name,
      race: characters.race,
      class: characters.class,
      level: characters.level,
      abilityScores: characters.abilityScores,
      hp: characters.hp,
      ac: characters.ac,
      skills: characters.skills,
      saves: characters.saves,
      attacks: characters.attacks,
      features: characters.features,
      description: characters.description,
      avatarPath: assets.path,
      avatarAssetId: characters.avatarAssetId,
    })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .leftJoin(assets, eq(assets.id, characters.avatarAssetId))
    .where(and(eq(characters.id, characterId), eq(characters.campaignId, campaignId)))
    .get();
}

function toSheet(row: NonNullable<ReturnType<typeof characterSelect>>): CharacterSheet {
  return {
    id: row.id,
    campaignId: row.campaignId,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    name: row.name,
    race: row.race,
    class: row.class,
    level: row.level,
    abilityScores: row.abilityScores,
    hp: row.hp,
    ac: row.ac,
    skills: row.skills,
    saves: row.saves,
    attacks: row.attacks,
    features: row.features,
    description: row.description,
    avatarUrl: avatarUrl(row.avatarPath),
    avatarAssetId: row.avatarAssetId,
  };
}

export function characterRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth);

  routes.get('/', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const rows = db
      .select({
        id: characters.id,
        name: characters.name,
        race: characters.race,
        class: characters.class,
        level: characters.level,
        ownerId: characters.ownerId,
        ownerName: users.name,
        avatarPath: assets.path,
      })
      .from(characters)
      .innerJoin(users, eq(users.id, characters.ownerId))
      .leftJoin(assets, eq(assets.id, characters.avatarAssetId))
      .where(eq(characters.campaignId, c.var.campaignId))
      .orderBy(characters.createdAt, characters.id)
      .all();
    return c.json({ characters: rows.map(toSummary) });
  });

  routes.post('/', requireCampaignRole(), async (c) => {
    const { db } = c.var.deps;
    const body = await c.req.json().catch(() => ({}));
    const parsed = parseCharacterInput(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 422);

    const avatar = parsed.value.avatarAssetId
      ? db.select().from(assets).where(eq(assets.id, parsed.value.avatarAssetId)).get()
      : undefined;
    if (parsed.value.avatarAssetId && (!avatar || avatar.campaignId !== c.var.campaignId)) {
      return c.json({ error: 'Imagem de avatar inválida.' }, 422);
    }

    const inserted = db
      .insert(characters)
      .values({ id: randomUUID(), campaignId: c.var.campaignId, ownerId: c.var.user.id, ...parsed.value })
      .returning({ id: characters.id })
      .get();
    const row = characterSelect(db, c.var.campaignId, inserted.id)!;
    return c.json({ character: toSheet(row) }, 201);
  });

  routes.get('/:characterId', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    return c.json({ character: toSheet(row) });
  });

  routes.patch('/:characterId', requireCampaignRole(), async (c) => {
    const { db } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    if (row.ownerId !== c.var.user.id) {
      return c.json({ error: 'Apenas o dono da ficha pode editá-la.' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = parseCharacterInput(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 422);

    const avatar = parsed.value.avatarAssetId
      ? db.select().from(assets).where(eq(assets.id, parsed.value.avatarAssetId)).get()
      : undefined;
    if (parsed.value.avatarAssetId && (!avatar || avatar.campaignId !== c.var.campaignId)) {
      return c.json({ error: 'Imagem de avatar inválida.' }, 422);
    }

    db.update(characters)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(and(eq(characters.id, row.id), eq(characters.campaignId, c.var.campaignId)))
      .run();

    const updated = characterSelect(db, c.var.campaignId, row.id)!;
    return c.json({ character: toSheet(updated) });
  });

  routes.delete('/:characterId', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    if (row.ownerId !== c.var.user.id && c.var.role !== 'master') {
      return c.json({ error: 'Apenas o dono ou o mestre podem excluir o personagem.' }, 403);
    }
    db.delete(characters).where(eq(characters.id, row.id)).run();
    return c.body(null, 204);
  });

  routes.post('/:characterId/rolls', requireCampaignRole(), async (c) => {
    const { db, hub } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    if (row.ownerId !== c.var.user.id) {
      return c.json({ error: 'Apenas o dono pode rolar a partir da ficha.' }, 403);
    }

    const body = (await c.req.json().catch(() => ({}))) as LinkedRollRequest;
    const parsed = parseLinkedRoll(body, row);
    if ('error' in parsed) return c.json({ error: parsed.error }, 422);
    if (!parsed.roll) return c.json({ error: 'Rolagem inválida.' }, 422);

    const event = recordRollEvent(db, {
      campaignId: c.var.campaignId,
      userId: c.var.user.id,
      userName: c.var.user.name,
      secret: false,
      payload: parsed.payload,
    });
    hub.publish(c.var.campaignId, event);
    return c.json({ event }, 201);
  });

  return routes;
}

type LinkedRollResult =
  | { roll?: undefined; error: string }
  | { roll: true; payload: RollPayload };

function parseLinkedRoll(body: LinkedRollRequest, row: NonNullable<ReturnType<typeof characterSelect>>): LinkedRollResult {
  const kind = body?.kind;
  const advantage = body?.advantage === true;
  const mode = advantage ? 'advantage' : 'normal';

  if (kind === 'attack') {
    const index = body?.attackIndex;
    const attack = Number.isInteger(index) ? row.attacks[Number(index)] : undefined;
    if (!attack) return { error: 'Ataque inválido.' };
    const expression = `1d20${attack.bonus >= 0 ? '+' : ''}${attack.bonus}`;
    const result = rollDice(expression, mode);
    if (!result) return { error: 'Rolagem inválida.' };
    return {
      roll: true,
      payload: {
        kind: 'roll',
        ...result,
        rollKind: 'attack',
        characterId: row.id,
        characterName: row.name,
        attackName: attack.name,
      },
    };
  }

  if (kind === 'check' || kind === 'save') {
    const ability = body?.ability;
    if (!isAbility(ability)) return { error: 'Atributo inválido.' };
    const modifier = abilityModifier(row.abilityScores[ability]) ?? 0;
    const bonus = kind === 'save' && row.saves.includes(ability) ? modifier + (proficiencyBonus(row.level) ?? 0) : modifier;
    const expression = `1d20${bonus >= 0 ? '+' : ''}${bonus}`;
    const result = rollDice(expression, mode);
    if (!result) return { error: 'Rolagem inválida.' };
    return {
      roll: true,
      payload: {
        kind: 'roll',
        ...result,
        rollKind: kind,
        characterId: row.id,
        characterName: row.name,
        ability,
      },
    };
  }

  return { error: 'Tipo de rolagem inválido.' };
}