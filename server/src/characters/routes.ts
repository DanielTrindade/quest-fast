import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { assets, characters, users, type CharacterRow, type Db } from '@quest-fast/db';
import {
  ABILITIES,
  CHARACTER_LIMITS as L,
  COINS,
  SPELL_SLOT_CAPS,
  abilityModifier,
  emptyCoins,
  emptySpellSlots,
  fitStateToSheet,
  initiative,
  isAbility,
  isArmorTraining,
  isHitDie,
  isRollMode,
  isSize,
  isSkill,
  isSpeed,
  parseDiceExpression,
  rollDice,
  saveBonus,
  skillAbility,
  skillBonus,
  spellAttackBonus,
  type Ability,
  type ArmorTraining,
  type Attack,
  type CharacterSheet,
  type CharacterSummary,
  type Coins,
  type DeathSaves,
  type HitDie,
  type LinkedRollRequest,
  type RollMode,
  type RollPayload,
  type Size,
  type Skill,
  type Spell,
} from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { recordRollEvent } from '../events/feed.ts';

// Error messages are player-facing, so they stay in Portuguese.
class InputError extends Error {}

function fail(message: string): never {
  throw new InputError(message);
}

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

/** Absent stays absent (a default on create, the stored value on edit). */
function optionalText(value: unknown, limit: number, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > limit) fail(`${label} deve ter até ${limit} caracteres.`);
  return value.trim();
}

function optionalInteger(value: unknown, min: number, max: number, message: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = boundedInteger(value, min, max);
  if (parsed === undefined) fail(message);
  return parsed;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') fail(`${label} inválido.`);
  return value;
}

/** A list of free lines: refusing beats silently dropping text on save. */
function optionalTextList(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > L.listItems) fail(`Limite de ${L.listItems} ${label}.`);
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > L.listItem) {
      fail(`Cada item de ${label} deve ter até ${L.listItem} caracteres.`);
    }
    if (item.length > 0) items.push(item);
  }
  return uniqueStrings(items);
}

function parseAttack(value: unknown): Attack | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const attack = value as Record<string, unknown>;
  const name = shortText(attack.name, L.name);
  const bonus = boundedInteger(attack.bonus, -L.attackBonus, L.attackBonus);
  const damage = shortText(attack.damage, L.damage);
  if (!name || bonus === undefined || !damage) return undefined;
  // Damage is a dice expression: catching a typo now beats a wrong roll later.
  if (!parseDiceExpression(damage)) return undefined;
  const damageType = attack.damageType === undefined ? '' : attack.damageType;
  const notes = attack.notes === undefined ? '' : attack.notes;
  if (typeof damageType !== 'string' || damageType.length > L.damageType) return undefined;
  if (typeof notes !== 'string' || notes.length > L.attackNotes) return undefined;
  return { name, bonus, damage, damageType: damageType.trim(), notes: notes.trim() };
}

function parseSpell(value: unknown): Spell {
  if (typeof value !== 'object' || value === null) fail('Magia inválida.');
  const spell = value as Record<string, unknown>;
  const level = boundedInteger(spell.level, 0, 9);
  const name = shortText(spell.name, L.spellName);
  if (level === undefined || !name) fail('Cada magia precisa de nome e de círculo entre 0 (truque) e 9.');
  return {
    level,
    name,
    castingTime: optionalText(spell.castingTime, L.spellShortText, 'O tempo de conjuração') ?? '',
    range: optionalText(spell.range, L.spellShortText, 'O alcance') ?? '',
    concentration: optionalBoolean(spell.concentration, 'Concentração') ?? false,
    ritual: optionalBoolean(spell.ritual, 'Ritual') ?? false,
    material: optionalBoolean(spell.material, 'Material') ?? false,
    notes: optionalText(spell.notes, L.spellNotes, 'As notas da magia') ?? '',
  };
}

function parseCoins(value: unknown): Coins | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null) fail('Moedas inválidas.');
  const source = value as Record<string, unknown>;
  const coins = emptyCoins();
  for (const coin of COINS) {
    const amount = source[coin] === undefined ? 0 : boundedInteger(source[coin], 0, L.coins);
    if (amount === undefined) fail(`Moedas devem ser números entre 0 e ${L.coins}.`);
    coins[coin] = amount;
  }
  return coins;
}

/** Everything the official sheet added, with the default of a new sheet. */
type OfficialFields = {
  subclass: string;
  background: string;
  alignment: string;
  experience: number;
  size: Size;
  shield: boolean;
  speed: number;
  hitDie: HitDie;
  initiativeBonus: number;
  passivePerceptionBonus: number;
  expertise: Skill[];
  armorTraining: ArmorTraining[];
  weaponProficiencies: string;
  toolProficiencies: string;
  speciesTraits: string[];
  feats: string[];
  spellcastingAbility: Ability | null;
  spellBonus: number;
  spellSlotTotals: number[];
  spells: Spell[];
  appearance: string;
  languages: string;
  equipment: string;
  attunedItems: string[];
  coins: Coins;
};

function officialDefaults(): OfficialFields {
  return {
    subclass: '',
    background: '',
    alignment: '',
    experience: 0,
    size: 'medium',
    shield: false,
    speed: 9,
    hitDie: 8,
    initiativeBonus: 0,
    passivePerceptionBonus: 0,
    expertise: [],
    armorTraining: [],
    weaponProficiencies: '',
    toolProficiencies: '',
    speciesTraits: [],
    feats: [],
    spellcastingAbility: null,
    spellBonus: 0,
    spellSlotTotals: SPELL_SLOT_CAPS.map(() => 0),
    spells: [],
    appearance: '',
    languages: '',
    equipment: '',
    attunedItems: [],
    coins: emptyCoins(),
  };
}

function officialFromSheet(sheet: CharacterSheet): OfficialFields {
  return {
    subclass: sheet.subclass,
    background: sheet.background,
    alignment: sheet.alignment,
    experience: sheet.experience,
    size: sheet.size,
    shield: sheet.shield,
    speed: sheet.speed,
    hitDie: sheet.hitDie,
    initiativeBonus: sheet.initiativeBonus,
    passivePerceptionBonus: sheet.passivePerceptionBonus,
    expertise: sheet.expertise,
    armorTraining: sheet.armorTraining,
    weaponProficiencies: sheet.weaponProficiencies,
    toolProficiencies: sheet.toolProficiencies,
    speciesTraits: sheet.speciesTraits,
    feats: sheet.feats,
    spellcastingAbility: sheet.spellcastingAbility,
    spellBonus: sheet.spellBonus,
    spellSlotTotals: sheet.spellSlots.map((slot) => slot.total),
    spells: sheet.spells,
    appearance: sheet.appearance,
    languages: sheet.languages,
    equipment: sheet.equipment,
    attunedItems: sheet.attunedItems,
    coins: sheet.coins,
  };
}

type CoreFields = {
  name: string;
  race: string;
  class: string;
  level: number;
  abilityScores: Record<Ability, number>;
  hp: number;
  ac: number;
  skills: Skill[];
  saves: Ability[];
  attacks: Attack[];
  features: string[];
  description: string;
  avatarAssetId: string | null;
};

type ParsedSheet = { core: CoreFields; official: Partial<OfficialFields> };

function parseOfficial(source: Record<string, unknown>): Partial<OfficialFields> {
  const official: Partial<OfficialFields> = {
    subclass: optionalText(source.subclass, L.shortText, 'A subclasse'),
    background: optionalText(source.background, L.shortText, 'O antecedente'),
    alignment: optionalText(source.alignment, L.shortText, 'O alinhamento'),
    experience: optionalInteger(source.experience, L.experience.min, L.experience.max, `XP deve ser um número entre ${L.experience.min} e ${L.experience.max}.`),
    shield: optionalBoolean(source.shield, 'Escudo'),
    initiativeBonus: optionalInteger(source.initiativeBonus, L.adjustment.min, L.adjustment.max, 'Ajuste de iniciativa inválido.'),
    passivePerceptionBonus: optionalInteger(source.passivePerceptionBonus, L.adjustment.min, L.adjustment.max, 'Ajuste de percepção passiva inválido.'),
    weaponProficiencies: optionalText(source.weaponProficiencies, L.proficiencyText, 'O treinamento em armas'),
    toolProficiencies: optionalText(source.toolProficiencies, L.proficiencyText, 'O treinamento em ferramentas'),
    speciesTraits: optionalTextList(source.speciesTraits, 'traços de espécie'),
    feats: optionalTextList(source.feats, 'talentos'),
    spellBonus: optionalInteger(source.spellBonus, L.adjustment.min, L.adjustment.max, 'Ajuste de conjuração inválido.'),
    appearance: optionalText(source.appearance, L.appearance, 'A aparência'),
    languages: optionalText(source.languages, L.languages, 'Os idiomas'),
    equipment: optionalText(source.equipment, L.equipment, 'O equipamento'),
    coins: parseCoins(source.coins),
  };

  if (source.size !== undefined) {
    if (!isSize(source.size)) fail('Tamanho inválido.');
    official.size = source.size;
  }
  if (source.speed !== undefined) {
    if (!isSpeed(source.speed)) fail(`Deslocamento deve estar entre ${L.speed.min} e ${L.speed.max} metros.`);
    official.speed = source.speed;
  }
  if (source.hitDie !== undefined) {
    if (!isHitDie(source.hitDie)) fail('Dado de vida deve ser d6, d8, d10 ou d12.');
    official.hitDie = source.hitDie;
  }
  if (source.expertise !== undefined) {
    if (!Array.isArray(source.expertise) || source.expertise.some((skill) => !isSkill(skill))) {
      fail('Especialização inválida.');
    }
    official.expertise = uniqueStrings(source.expertise as Skill[]);
  }
  if (source.armorTraining !== undefined) {
    if (!Array.isArray(source.armorTraining) || source.armorTraining.some((kind) => !isArmorTraining(kind))) {
      fail('Treinamento em armaduras inválido.');
    }
    official.armorTraining = uniqueStrings(source.armorTraining as ArmorTraining[]);
  }
  if (source.spellcastingAbility !== undefined) {
    if (source.spellcastingAbility !== null && !isAbility(source.spellcastingAbility)) {
      fail('Atributo de conjuração inválido.');
    }
    official.spellcastingAbility = source.spellcastingAbility;
  }
  if (source.spellSlotTotals !== undefined) {
    const totals = source.spellSlotTotals;
    if (
      !Array.isArray(totals) ||
      totals.length !== SPELL_SLOT_CAPS.length ||
      totals.some((total, circle) => boundedInteger(total, 0, SPELL_SLOT_CAPS[circle] ?? 0) === undefined)
    ) {
      fail('Cada círculo aceita de 0 até o número de espaços da ficha.');
    }
    official.spellSlotTotals = totals as number[];
  }
  if (source.spells !== undefined) {
    if (!Array.isArray(source.spells) || source.spells.length > L.spells) fail(`Limite de ${L.spells} magias.`);
    official.spells = source.spells.map(parseSpell);
  }
  if (source.attunedItems !== undefined) {
    const items = source.attunedItems;
    if (!Array.isArray(items) || items.length > L.attunedItems) {
      fail(`Um personagem se sintoniza com até ${L.attunedItems} itens.`);
    }
    official.attunedItems = items.map((item) => {
      const name = shortText(item, L.attunedItem);
      if (!name) fail(`Cada item sintonizado precisa de nome com até ${L.attunedItem} caracteres.`);
      return name;
    });
  }

  // Undefined keys are "not sent", so they must not overwrite anything.
  return Object.fromEntries(Object.entries(official).filter(([, value]) => value !== undefined));
}

/** Validates the whole sheet. Editing uses the same shape, so one parser. */
function parseCharacterInput(body: unknown): ParsedSheet {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const name = shortText(source.name, L.name);
  if (!name) fail(`Informe um nome de até ${L.name} caracteres.`);

  const race = shortText(source.race, L.shortText);
  const className = shortText(source.class, L.shortText);
  if (!race || !className) fail(`Espécie e classe são obrigatórias (até ${L.shortText} caracteres).`);

  const level = boundedInteger(source.level, L.level.min, L.level.max);
  if (!level) fail(`Nível deve ser um número entre ${L.level.min} e ${L.level.max}.`);

  const rawScores = source.abilityScores;
  if (typeof rawScores !== 'object' || rawScores === null) fail('Informe os seis atributos.');
  const scores = rawScores as Record<string, unknown>;
  const abilityScores = {} as Record<Ability, number>;
  for (const ability of ABILITIES) {
    const value = boundedInteger(scores[ability], L.abilityScore.min, L.abilityScore.max);
    if (!value) fail(`Atributos devem ser números entre ${L.abilityScore.min} e ${L.abilityScore.max}.`);
    abilityScores[ability] = value;
  }

  const hp = boundedInteger(source.hp, L.hp.min, L.hp.max);
  const ac = boundedInteger(source.ac, L.ac.min, L.ac.max);
  if (!hp || ac === undefined) fail('HP e CA devem ser números dentro dos limites.');

  const skillsInput = Array.isArray(source.skills) ? source.skills : [];
  if (skillsInput.some((skill) => !isSkill(skill))) fail('Perícia inválida.');
  const skills = uniqueStrings(skillsInput as Skill[]);

  const savesInput = Array.isArray(source.saves) ? source.saves : [];
  if (savesInput.some((ability) => !isAbility(ability))) fail('Teste de resistência inválido.');
  const saves = uniqueStrings(savesInput as Ability[]);

  const attacksInput = Array.isArray(source.attacks) ? source.attacks : [];
  if (attacksInput.length > L.attacks) fail(`Limite de ${L.attacks} ataques.`);
  const attacks = attacksInput.map((raw) => {
    const attack = parseAttack(raw);
    if (!attack) fail('Ataque inválido: nome, bônus e dano (expressão como 1d8+3).');
    return attack;
  });

  const featuresInput = Array.isArray(source.features) ? source.features : [];
  if (featuresInput.length > L.listItems) fail(`Limite de ${L.listItems} características.`);
  const features: string[] = [];
  for (const feature of featuresInput) {
    // Refusing beats silently dropping: the master must not lose text on save.
    if (typeof feature !== 'string' || feature.length > L.listItem) {
      fail(`Cada característica deve ter até ${L.listItem} caracteres.`);
    }
    if (feature.length > 0) features.push(feature);
  }

  const description = typeof source.description === 'string' ? source.description : '';
  if (description.length > L.description) fail(`A descrição deve ter até ${L.description} caracteres.`);
  const avatarAssetId =
    typeof source.avatarAssetId === 'string' && source.avatarAssetId.length > 0 ? source.avatarAssetId : null;

  return {
    core: {
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
    official: parseOfficial(source),
  };
}

/** Expertise is a subset of proficiency; an edit that drops a skill drops its expertise. */
function checkExpertise(official: OfficialFields, skills: Skill[], sent: boolean): OfficialFields {
  if (sent && official.expertise.some((skill) => !skills.includes(skill))) {
    fail('Especialização exige proficiência na perícia.');
  }
  return { ...official, expertise: official.expertise.filter((skill) => skills.includes(skill)) };
}

/** Splits the editor's slot totals from the columns stored as they are. */
function officialColumns({ spellSlotTotals: _totals, ...columns }: OfficialFields) {
  return columns;
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
  hp: number;
  hpCurrent: number;
  hpTemp: number;
  ac: number;
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
    hp: row.hp,
    hpCurrent: row.hpCurrent,
    hpTemp: row.hpTemp,
    ac: row.ac,
  };
}

function characterSelect(db: Db, campaignId: string, characterId: string) {
  return db
    .select({ character: characters, ownerName: users.name, avatarPath: assets.path })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .leftJoin(assets, eq(assets.id, characters.avatarAssetId))
    .where(and(eq(characters.id, characterId), eq(characters.campaignId, campaignId)))
    .get();
}

type SelectedCharacter = { character: CharacterRow; ownerName: string; avatarPath: string | null };

/** Rows stored before a field existed read as that field's default. */
function toSheet({ character: row, ownerName, avatarPath }: SelectedCharacter): CharacterSheet {
  const { createdAt: _created, updatedAt: _updated, spellSlots, attacks, ...fields } = row;
  return {
    ...fields,
    ownerName,
    attacks: attacks.map((attack) => ({ ...attack, damageType: attack.damageType ?? '', notes: attack.notes ?? '' })),
    spellSlots: emptySpellSlots().map((empty, circle) => spellSlots[circle] ?? empty),
    avatarUrl: avatarUrl(avatarPath),
  };
}

function checkAvatar(db: Db, campaignId: string, avatarAssetId: string | null) {
  if (!avatarAssetId) return;
  const avatar = db.select().from(assets).where(eq(assets.id, avatarAssetId)).get();
  if (!avatar || avatar.campaignId !== campaignId) fail('Imagem de avatar inválida.');
}

function parseDeathSaves(value: unknown): DeathSaves | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null) fail('Salvaguardas contra a morte inválidas.');
  const source = value as Record<string, unknown>;
  const successes = boundedInteger(source.successes, 0, L.deathSaves);
  const failures = boundedInteger(source.failures, 0, L.deathSaves);
  if (successes === undefined || failures === undefined) {
    fail(`Sucessos e falhas contra a morte vão de 0 a ${L.deathSaves}.`);
  }
  return { successes, failures };
}

/** The session state, bounded by the sheet it belongs to. */
function parseStateInput(body: unknown, sheet: CharacterSheet) {
  const source = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const state = {
    hpCurrent: optionalInteger(source.hpCurrent, 0, sheet.hp, 'PV atual deve estar entre 0 e o PV máximo.'),
    hpTemp: optionalInteger(source.hpTemp, L.hpTemp.min, L.hpTemp.max, `PV temporários devem estar entre ${L.hpTemp.min} e ${L.hpTemp.max}.`),
    hitDiceSpent: optionalInteger(source.hitDiceSpent, 0, sheet.level, 'Dados de vida gastos devem estar entre 0 e o nível.'),
    deathSaves: parseDeathSaves(source.deathSaves),
    heroicInspiration: optionalBoolean(source.heroicInspiration, 'Inspiração heroica'),
    coins: parseCoins(source.coins),
    spellSlots: undefined as CharacterSheet['spellSlots'] | undefined,
  };
  if (source.spellSlotsSpent !== undefined) {
    const spent = source.spellSlotsSpent;
    if (
      !Array.isArray(spent) ||
      spent.length !== SPELL_SLOT_CAPS.length ||
      spent.some((count, circle) => boundedInteger(count, 0, sheet.spellSlots[circle]?.total ?? 0) === undefined)
    ) {
      fail('Espaços gastos devem estar entre 0 e o total de cada círculo.');
    }
    state.spellSlots = sheet.spellSlots.map((slot, circle) => ({ total: slot.total, spent: spent[circle] as number }));
  }
  const changes = Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined));
  if (Object.keys(changes).length === 0) fail('Nada para atualizar.');
  return changes as Partial<Pick<CharacterRow, 'hpCurrent' | 'hpTemp' | 'hitDiceSpent' | 'deathSaves' | 'heroicInspiration' | 'coins' | 'spellSlots'>>;
}

/** Runs a handler whose parsing throws `InputError`, answering 422 with its message. */
async function withInput<T>(run: () => T | Promise<T>): Promise<T | { inputError: string }> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof InputError) return { inputError: error.message };
    throw error;
  }
}

function isInputError(value: unknown): value is { inputError: string } {
  return typeof value === 'object' && value !== null && 'inputError' in value;
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
        hp: characters.hp,
        hpCurrent: characters.hpCurrent,
        hpTemp: characters.hpTemp,
        ac: characters.ac,
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
    const result = await withInput(() => {
      const { core, official: sent } = parseCharacterInput(body);
      checkAvatar(db, c.var.campaignId, core.avatarAssetId);
      const official = checkExpertise({ ...officialDefaults(), ...sent }, core.skills, sent.expertise !== undefined);
      // A new character starts rested: full hit points, nothing spent.
      return db
        .insert(characters)
        .values({
          id: randomUUID(),
          campaignId: c.var.campaignId,
          ownerId: c.var.user.id,
          ...core,
          ...officialColumns(official),
          spellSlots: official.spellSlotTotals.map((total) => ({ total, spent: 0 })),
          hpCurrent: core.hp,
        })
        .returning({ id: characters.id })
        .get();
    });
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);
    const row = characterSelect(db, c.var.campaignId, result.id)!;
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
    if (row.character.ownerId !== c.var.user.id) {
      return c.json({ error: 'Apenas o dono da ficha pode editá-la.' }, 403);
    }

    const current = toSheet(row);
    const body = await c.req.json().catch(() => ({}));
    const result = await withInput(() => {
      const { core, official: sent } = parseCharacterInput(body);
      checkAvatar(db, c.var.campaignId, core.avatarAssetId);
      // Fields the request did not send keep their stored value.
      const official = checkExpertise({ ...officialFromSheet(current), ...sent }, core.skills, sent.expertise !== undefined);
      const fitted = fitStateToSheet(current, { hp: core.hp, level: core.level, spellSlotTotals: official.spellSlotTotals });
      db.update(characters)
        .set({
          ...core,
          ...officialColumns(official),
          hpCurrent: fitted.hpCurrent,
          hitDiceSpent: fitted.hitDiceSpent,
          spellSlots: fitted.spellSlots,
          updatedAt: new Date(),
        })
        .where(and(eq(characters.id, current.id), eq(characters.campaignId, c.var.campaignId)))
        .run();
    });
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);

    const updated = characterSelect(db, c.var.campaignId, current.id)!;
    return c.json({ character: toSheet(updated) });
  });

  // Play state without resending the sheet: a quick control must neither
  // depend on the whole form nor overwrite an edit made elsewhere.
  routes.patch('/:characterId/state', requireCampaignRole(), async (c) => {
    const { db } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    if (row.character.ownerId !== c.var.user.id) {
      return c.json({ error: 'Apenas o dono da ficha pode alterar o estado do personagem.' }, 403);
    }

    const sheet = toSheet(row);
    const body = await c.req.json().catch(() => ({}));
    const result = await withInput(() => {
      const changes = parseStateInput(body, sheet);
      db.update(characters)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(characters.id, sheet.id), eq(characters.campaignId, c.var.campaignId)))
        .run();
    });
    if (isInputError(result)) return c.json({ error: result.inputError }, 422);

    const updated = characterSelect(db, c.var.campaignId, sheet.id)!;
    return c.json({ character: toSheet(updated) });
  });

  routes.delete('/:characterId', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    if (row.character.ownerId !== c.var.user.id && c.var.role !== 'master') {
      return c.json({ error: 'Apenas o dono ou o mestre podem excluir o personagem.' }, 403);
    }
    db.delete(characters).where(eq(characters.id, row.character.id)).run();
    return c.body(null, 204);
  });

  routes.post('/:characterId/rolls', requireCampaignRole(), async (c) => {
    const { db, hub } = c.var.deps;
    const row = characterSelect(db, c.var.campaignId, c.req.param('characterId'));
    if (!row) return c.json({ error: 'Personagem não encontrado.' }, 404);
    if (row.character.ownerId !== c.var.user.id) {
      return c.json({ error: 'Apenas o dono pode rolar a partir da ficha.' }, 403);
    }

    const body = (await c.req.json().catch(() => ({}))) as LinkedRollRequest;
    const parsed = parseLinkedRoll(body, toSheet(row));
    if ('error' in parsed) return c.json({ error: parsed.error }, 422);

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

type LinkedRollResult = { error: string } | { payload: RollPayload };

/** Every linked roll is a single d20 plus a bonus the server derives from the sheet. */
function d20(
  sheet: CharacterSheet,
  bonus: number,
  mode: RollMode,
  details: Pick<RollPayload, 'rollKind' | 'attackName' | 'ability' | 'skill'>,
): LinkedRollResult {
  const result = rollDice(`1d20${bonus >= 0 ? '+' : ''}${bonus}`, mode);
  if (!result) return { error: 'Rolagem inválida.' };
  return { payload: { kind: 'roll', ...result, ...details, characterId: sheet.id, characterName: sheet.name } };
}

function parseLinkedRoll(body: LinkedRollRequest, sheet: CharacterSheet): LinkedRollResult {
  const kind = body?.kind;

  // An unknown mode is a malformed request, not "normal": silently rolling
  // without the requested advantage would hide the client's bug.
  const rawMode = body?.mode;
  if (rawMode !== undefined && !isRollMode(rawMode)) return { error: 'Modo de rolagem inválido.' };
  const mode: RollMode = rawMode ?? 'normal';

  if (kind === 'attack') {
    const index = body?.attackIndex;
    const attack = Number.isInteger(index) ? sheet.attacks[Number(index)] : undefined;
    if (!attack) return { error: 'Ataque inválido.' };
    return d20(sheet, attack.bonus, mode, { rollKind: 'attack', attackName: attack.name });
  }

  if (kind === 'check' || kind === 'save') {
    const ability = body?.ability;
    if (!isAbility(ability)) return { error: 'Atributo inválido.' };
    const bonus = kind === 'save' ? saveBonus(sheet, ability) : (abilityModifier(sheet.abilityScores[ability]) ?? 0);
    return d20(sheet, bonus, mode, { rollKind: kind, ability });
  }

  if (kind === 'skill') {
    const skill = body?.skill;
    if (!isSkill(skill)) return { error: 'Perícia inválida.' };
    return d20(sheet, skillBonus(sheet, skill), mode, { rollKind: 'skill', ability: skillAbility(skill), skill });
  }

  if (kind === 'initiative') {
    return d20(sheet, initiative(sheet), mode, { rollKind: 'initiative', ability: 'dexterity' });
  }

  if (kind === 'spellAttack') {
    const bonus = spellAttackBonus(sheet);
    if (bonus === null || !sheet.spellcastingAbility) {
      return { error: 'O personagem não tem atributo de conjuração.' };
    }
    return d20(sheet, bonus, mode, { rollKind: 'spellAttack', ability: sheet.spellcastingAbility });
  }

  return { error: 'Tipo de rolagem inválido.' };
}
