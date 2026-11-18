import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import sharp from 'sharp';
import {
  abilityModifier,
  defaultAttackCost,
  emptySpellSlots,
  freshTurn,
  generateInviteCode,
  healthBand,
  initials,
  type Ability,
  type AbilityScores,
  type ActiveCondition,
  type Attack,
  type CombatPayload,
  type CombatReminder,
  type DieResult,
  type RollPayload,
  type SaveEffect,
  type Size,
  type Spell,
  type SpellCastPayload,
  type SpellSlot,
} from '@quest-fast/shared';
import {
  assets,
  campaignMembers,
  campaigns,
  characters,
  combatants,
  createDb,
  encounters,
  scenes,
  sessionEvents,
  sessions,
  statblocks,
  tokens,
  users,
} from '@quest-fast/db';
import { normalizeAvatar } from './assets/image.ts';
import { normaliseMap } from './assets/maps.ts';
import { createDiskAssetStore } from './assets/store.ts';

/*
 * Showcase data for reviewing the interface: one user who is master of a
 * campaign in the middle of a fight, player in another, and master of an
 * empty one. Must not be run in production.
 *
 *   npm run db:seed:showcase                 # fictional user, prints the cookie
 *   npm run db:seed:showcase -- <discordId>  # your own account (log in once first)
 */

if (process.env.NODE_ENV === 'production') {
  console.error('O seed de vitrine é só para desenvolvimento local e não roda em produção.');
  process.exit(1);
}

if (process.env.R2_BUCKET?.trim()) {
  console.error('O seed de vitrine grava imagens no disco local. Remova as variáveis R2_* do ambiente e rode de novo.');
  process.exit(1);
}

const db = createDb();
const uploadsDir = resolve(process.env.UPLOADS_DIR?.trim() || 'uploads');
const store = createDiskAssetStore(uploadsDir);

const SHOWCASE_PREFIX = 'showcase-';

type Profile = { discordId: string; name: string };

function ensureUser(profile: Profile) {
  db.insert(users).values({ id: randomUUID(), ...profile, avatarUrl: null }).onConflictDoNothing().run();
  return db.select().from(users).where(eq(users.discordId, profile.discordId)).get()!;
}

const ownDiscordId = process.argv[2]?.trim();
const you = ownDiscordId
  ? db.select().from(users).where(eq(users.discordId, ownDiscordId)).get()
  : ensureUser({ discordId: `${SHOWCASE_PREFIX}you`, name: 'Você (vitrine)' });
if (!you) {
  console.error(`Nenhum usuário com o Discord ${ownDiscordId}. Entre no app uma vez com essa conta e rode de novo.`);
  process.exit(1);
}
const marina = ensureUser({ discordId: `${SHOWCASE_PREFIX}marina`, name: 'Marina Duarte' });
const tiago = ensureUser({ discordId: `${SHOWCASE_PREFIX}tiago`, name: 'Tiago Rocha' });
const camila = ensureUser({ discordId: `${SHOWCASE_PREFIX}camila`, name: 'Camila Nunes' });
const joaquim = ensureUser({ discordId: `${SHOWCASE_PREFIX}joaquim`, name: 'Joaquim Pereira Lopes de Albuquerque Neto' });

// Campaign ids are derived from the account, so a rerun finds exactly what
// the previous one created: a name says nothing about where a campaign came from.
function showcaseCampaignId(key: string) {
  const hex = createHash('sha256').update(`${SHOWCASE_PREFIX}${you!.id}:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const CAMPAIGN_IDS = { coroa: showcaseCampaignId('coroa'), ruinas: showcaseCampaignId('ruinas'), empty: showcaseCampaignId('empty') };

async function removePreviousShowcase() {
  const previous = db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(inArray(campaigns.id, Object.values(CAMPAIGN_IDS)))
    .all();
  for (const { id } of previous) {
    // The scene's map asset is ON DELETE RESTRICT: scenes go before the campaign cascade.
    db.delete(scenes).where(eq(scenes.campaignId, id)).run();
    db.delete(campaigns).where(eq(campaigns.id, id)).run();
    await rm(join(uploadsDir, 'campaigns', id), { recursive: true, force: true });
  }
  return previous.length;
}
const removed = await removePreviousShowcase();

// --- Images ---------------------------------------------------------------

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function portraitSvg(name: string, hue: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="g" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="hsl(${hue},55%,62%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},45%,22%)"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="210" r="96" fill="hsl(${hue},30%,90%)" opacity="0.25"/>
  <path d="M96 512 C120 360 392 360 416 512 Z" fill="hsl(${hue},30%,90%)" opacity="0.25"/>
  <text x="256" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="190" font-weight="700" fill="#fff" opacity="0.92">${escapeXml(initials(name))}</text>
</svg>`;
}

const CELL = 60;

function dungeonSvg() {
  const rooms = [
    [2, 2, 8, 6],
    [14, 1, 10, 7],
    [3, 11, 7, 7],
    [15, 11, 12, 8],
  ];
  const corridors = [
    [10, 4, 4, 2],
    [5, 8, 2, 3],
    [19, 8, 2, 3],
    [10, 14, 5, 2],
  ];
  const rect = ([x, y, w, h]: number[], fill: string) =>
    `<rect x="${x * CELL}" y="${y * CELL}" width="${w * CELL}" height="${h * CELL}" fill="${fill}" stroke="#2b2118" stroke-width="10"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200">
  <rect width="1800" height="1200" fill="#1d1a17"/>
  ${corridors.map((c) => rect(c, '#8a7a63')).join('\n  ')}
  ${rooms.map((r) => rect(r, '#a8977c')).join('\n  ')}
  <circle cx="${19 * CELL}" cy="${4.5 * CELL}" r="${2 * CELL}" fill="#3d6f8f" opacity="0.85"/>
  <circle cx="${19 * CELL}" cy="${4.5 * CELL}" r="${1.2 * CELL}" fill="#2c5570"/>
  <rect x="${16 * CELL}" y="${12 * CELL}" width="${10 * CELL}" height="${2 * CELL}" fill="#3d6f8f" opacity="0.6"/>
  <g fill="#5b4a36">
    <rect x="${4 * CELL}" y="${13 * CELL}" width="${CELL}" height="${CELL}"/>
    <rect x="${7 * CELL}" y="${15 * CELL}" width="${CELL}" height="${CELL}"/>
    <rect x="${23 * CELL}" y="${16 * CELL}" width="${2 * CELL}" height="${CELL}"/>
  </g>
  <g stroke="#2b2118" stroke-width="4" opacity="0.35">
    <line x1="${3 * CELL}" y1="${3 * CELL}" x2="${9 * CELL}" y2="${7 * CELL}"/>
    <line x1="${16 * CELL}" y1="${17 * CELL}" x2="${26 * CELL}" y2="${17 * CELL}"/>
  </g>
</svg>`;
}

function coastSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200">
  <rect width="1800" height="1200" fill="#2f6f8a"/>
  <path d="M0 0 H1800 V420 C1500 520 1300 380 1000 470 C700 560 400 430 0 520 Z" fill="#d8c89a"/>
  <path d="M0 0 H1800 V300 C1500 380 1300 260 1000 340 C700 420 400 300 0 380 Z" fill="#6d8a4c"/>
  <g fill="#4a3b2a">
    <rect x="620" y="700" width="420" height="120" rx="40" transform="rotate(-12 830 760)"/>
    <rect x="1250" y="880" width="260" height="80" rx="30" transform="rotate(20 1380 920)"/>
  </g>
  <g fill="#3f5f2c">
    <circle cx="200" cy="150" r="70"/><circle cx="420" cy="110" r="60"/><circle cx="1500" cy="140" r="80"/>
  </g>
</svg>`;
}

function cryptSvg() {
  const pillars = Array.from({ length: 8 }, (_, i) => {
    const x = (4 + (i % 4) * 6) * CELL;
    const y = (i < 4 ? 5 : 14) * CELL;
    return `<circle cx="${x}" cy="${y}" r="${0.8 * CELL}" fill="#4b4f57" stroke="#1c1d21" stroke-width="8"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200">
  <rect width="1800" height="1200" fill="#141518"/>
  <rect x="${2 * CELL}" y="${2 * CELL}" width="${26 * CELL}" height="${16 * CELL}" fill="#7d7f86" stroke="#1c1d21" stroke-width="12"/>
  <rect x="${12 * CELL}" y="${8 * CELL}" width="${6 * CELL}" height="${4 * CELL}" fill="#5c4630" stroke="#1c1d21" stroke-width="8"/>
  ${pillars.join('\n  ')}
</svg>`;
}

async function storeAvatar(campaignId: string, uploaderId: string, name: string, hue: number) {
  const result = await normalizeAvatar(new Uint8Array(await sharp(Buffer.from(portraitSvg(name, hue))).png().toBuffer()));
  if (!result.ok) throw new Error(result.error);
  const saved = await store.save(campaignId, result.image.buffer, result.image.mimeType);
  const id = randomUUID();
  db.insert(assets)
    .values({ id, campaignId, uploadedById: uploaderId, path: saved.path, mimeType: result.image.mimeType, size: result.image.buffer.byteLength })
    .run();
  return id;
}

async function storeMap(campaignId: string, uploaderId: string, svg: string) {
  const result = await normaliseMap(new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer()));
  if (!result.ok) throw new Error(result.error);
  const saved = await store.save(campaignId, result.map.buffer, result.map.mimeType);
  const id = randomUUID();
  db.insert(assets)
    .values({ id, campaignId, uploadedById: uploaderId, path: saved.path, mimeType: result.map.mimeType, size: result.map.buffer.byteLength })
    .run();
  return { id, width: result.map.width, height: result.map.height };
}

// --- Campaigns and members -------------------------------------------------

function createCampaign(id: string, name: string, description: string, master: { id: string }, players: { id: string }[]) {
  db.insert(campaigns).values({ id, name, description, inviteCode: generateInviteCode() }).run();
  db.insert(campaignMembers).values({ id: randomUUID(), campaignId: id, userId: master.id, role: 'master' }).run();
  for (const player of players) {
    db.insert(campaignMembers).values({ id: randomUUID(), campaignId: id, userId: player.id, role: 'player' }).run();
  }
  return id;
}

// --- Sheets ----------------------------------------------------------------

type SheetInput = Partial<typeof characters.$inferInsert> & {
  name: string;
  race: string;
  class: string;
  level: number;
  ownerId: string;
  abilityScores: AbilityScores;
  hp: number;
  ac: number;
};

function spell(level: number, name: string, extra: Partial<Spell> = {}): Spell {
  return {
    level,
    name,
    castingTime: '1 ação',
    range: '18 m',
    concentration: false,
    ritual: false,
    material: false,
    notes: '',
    ...extra,
  };
}

function slots(...totalsAndSpent: [number, number][]): SpellSlot[] {
  const result = emptySpellSlots();
  totalsAndSpent.forEach(([total, spent], circle) => {
    result[circle] = { total, spent };
  });
  return result;
}

function weapon(name: string, bonus: number, damage: string, damageType: string, notes = ''): Attack {
  return { kind: 'attack', name, bonus, damage, damageType, notes, cost: defaultAttackCost('attack') };
}

function saveAttack(
  name: string,
  dc: number,
  saveAbility: Ability,
  damage: string,
  damageType: string,
  notes = '',
  onSave: SaveEffect = 'half',
): Attack {
  return { kind: 'save', name, dc, saveAbility, onSave, damage, damageType, notes, cost: defaultAttackCost('save') };
}

function createCharacter(campaignId: string, sheet: SheetInput) {
  const id = randomUUID();
  db.insert(characters)
    .values({
      skills: [],
      saves: [],
      attacks: [],
      features: [],
      hpCurrent: sheet.hp,
      active: true,
      ...sheet,
      id,
      campaignId,
    })
    .run();
  return id;
}

// --- Bestiary --------------------------------------------------------------

type CreatureInput = Omit<typeof statblocks.$inferInsert, 'id' | 'campaignId'>;

function createStatblocks(campaignId: string, entries: CreatureInput[]) {
  const byName = new Map<string, CreatureInput & { id: string }>();
  for (const entry of entries) {
    const id = randomUUID();
    db.insert(statblocks).values({ ...entry, id, campaignId }).run();
    byName.set(entry.name, { ...entry, id });
  }
  return byName;
}

// --- Encounters ------------------------------------------------------------

type CharacterFighter = {
  characterId: string;
  name: string;
  dexterity: number;
  size?: Size;
  initiative?: number | null;
  reminders?: CombatReminder[];
};

type CreatureFighter = {
  creature: CreatureInput & { id: string };
  name: string;
  hpCurrent?: number;
  hpTemp?: number;
  conditions?: ActiveCondition[];
  concentrating?: boolean;
  hidden?: boolean;
  initiative?: number | null;
  reminders?: CombatReminder[];
};

function addCharacterFighter(encounterId: string, fighter: CharacterFighter) {
  const id = randomUUID();
  db.insert(combatants)
    .values({
      id,
      encounterId,
      source: 'character',
      characterId: fighter.characterId,
      name: fighter.name,
      size: fighter.size ?? 'medium',
      dexModifier: abilityModifier(fighter.dexterity) ?? 0,
      initiative: fighter.initiative ?? null,
      reminders: fighter.reminders ?? [],
    })
    .run();
  return id;
}

function addCreatureFighter(encounterId: string, fighter: CreatureFighter) {
  const { creature } = fighter;
  const id = randomUUID();
  db.insert(combatants)
    .values({
      id,
      encounterId,
      source: 'statblock',
      statblockId: creature.id,
      name: fighter.name,
      size: creature.size ?? 'medium',
      ac: creature.ac,
      hpMax: creature.hpAverage,
      hpCurrent: fighter.hpCurrent ?? creature.hpAverage,
      hpTemp: fighter.hpTemp ?? 0,
      conditions: fighter.conditions ?? [],
      concentrating: fighter.concentrating ?? false,
      hidden: fighter.hidden ?? false,
      dexModifier: abilityModifier(creature.abilityScores.dexterity) ?? 0,
      initiativeBonus: creature.initiativeBonus ?? 0,
      constitutionModifier: abilityModifier(creature.abilityScores.constitution) ?? 0,
      attacks: creature.attacks,
      attacksPerAction: creature.attacksPerAction ?? 1,
      initiative: fighter.initiative ?? null,
      reminders: fighter.reminders ?? [],
    })
    .run();
  return id;
}

// --- Feed ------------------------------------------------------------------

type FeedClock = { campaignId: string; at: number };

function feedClock(campaignId: string, minutesAgo: number): FeedClock {
  return { campaignId, at: Date.now() - minutesAgo * 60_000 };
}

function post(
  clock: FeedClock,
  userId: string,
  type: string,
  payload: RollPayload | CombatPayload | SpellCastPayload,
  secret = false,
) {
  const id = randomUUID();
  // A minute apart: the feed orders by second, and ties would shuffle the story.
  clock.at += 60_000;
  db.insert(sessionEvents)
    .values({ id, campaignId: clock.campaignId, userId, type, secret, payload, createdAt: new Date(clock.at) })
    .run();
  return id;
}

function d20(value: number, modifier: number, extra: Partial<RollPayload> = {}): RollPayload {
  const sign = modifier >= 0 ? '+' : '-';
  return {
    kind: 'roll',
    expression: modifier === 0 ? '1d20' : `1d20${sign}${Math.abs(modifier)}`,
    dice: [{ value, sides: 20 }],
    modifier,
    total: value + modifier,
    mode: 'normal',
    ...(value === 20 ? { natural: 20 as const } : value === 1 ? { natural: 1 as const } : {}),
    ...extra,
  };
}

function withAdvantage(kept: number, other: number, modifier: number, extra: Partial<RollPayload> = {}): RollPayload {
  const base = d20(kept, modifier, extra);
  const dice: DieResult[] = [
    { value: kept, sides: 20 },
    { value: other, sides: 20, discarded: true },
  ];
  return { ...base, dice, mode: 'advantage' };
}

function free(expression: string, dice: DieResult[], modifier: number): RollPayload {
  const total = dice.filter((die) => !die.discarded).reduce((sum, die) => sum + die.value, 0) + modifier;
  return { kind: 'roll', expression, dice, modifier, total, mode: 'normal' };
}

function damageRoll(expression: string, faces: number[], sides: number, modifier: number, damageType: string) {
  return {
    expression,
    dice: faces.map((value) => ({ value, sides })),
    modifier,
    total: faces.reduce((sum, value) => sum + value, 0) + modifier,
    damageType,
  };
}

// ===========================================================================
// Campaign 1: you are the master, mid-fight.
// ===========================================================================

const coroa = createCampaign(
  CAMPAIGN_IDS.coroa,
  'A Coroa Afogada',
  'O farol de Porto Salgado se apagou na noite em que a maré não voltou. Desde então, sinos tocam debaixo d\'água e os pescadores juram ver uma coroa de coral brilhando no fundo da baía. O grupo foi contratado pela Guilda dos Marinheiros para descobrir o que acordou nas ruínas submersas — e quem está pagando os sahuagin para atacar as caravanas da costa.',
  you,
  [marina, tiago, camila, joaquim],
);

const isoldeAvatar = await storeAvatar(coroa, marina.id, 'Isolde Ventomar', 205);
const kaelAvatar = await storeAvatar(coroa, tiago.id, 'Kael Ferro-Rubro', 10);
const nymAvatar = await storeAvatar(coroa, camila.id, 'Nym Folhaclara', 120);
const seaHagImage = await storeAvatar(coroa, you.id, 'Bruxa do Mar', 165);
const sharkImage = await storeAvatar(coroa, you.id, 'Tubarão', 220);

const isoldeScores = { strength: 18, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 12, charisma: 16 };
const isolde = createCharacter(coroa, {
  ownerId: marina.id,
  name: 'Isolde Ventomar',
  race: 'Humana',
  class: 'Paladina',
  subclass: 'Juramento de Devoção',
  level: 6,
  background: 'Acólita',
  alignment: 'Leal e Boa',
  experience: 14500,
  abilityScores: isoldeScores,
  hp: 58,
  hpCurrent: 31,
  ac: 20,
  shield: true,
  speed: 9,
  hitDie: 10,
  hitDiceSpent: 2,
  skills: ['athletics', 'insight', 'persuasion', 'religion'],
  saves: ['wisdom', 'charisma'],
  armorTraining: ['light', 'medium', 'heavy', 'shields'],
  weaponProficiencies: 'Armas Simples e Marciais',
  toolProficiencies: 'Kit de caligrafia',
  attacks: [
    weapon('Espada longa', 7, '1d8+4', 'Cortante', 'Versátil (1d10)'),
    weapon('Azagaia', 7, '1d6+4', 'Perfurante', 'Arremesso 9/36 m'),
    weapon('Destruição Divina', 7, '1d8+4+2d8', 'Radiante', 'Gasta um espaço de 1º círculo'),
  ],
  features: [
    'Sentido Divino',
    'Cura pelas Mãos (30 PV)',
    'Estilo de Luta: Defesa',
    'Canalizar Divindade: Arma Sagrada',
    'Ataque Extra',
    'Aura de Proteção (+3 em salvaguardas)',
  ],
  speciesTraits: ['Engenhosa', 'Habilidosa', 'Versátil'],
  feats: ['Iniciado em Magia (Clérigo)', 'Sentinela'],
  spellcastingAbility: 'charisma',
  spellSlots: slots([4, 3], [2, 1]),
  spells: [
    spell(1, 'Bênção', { concentration: true, material: true, range: '9 m' }),
    spell(1, 'Escudo da Fé', { castingTime: '1 ação bônus', concentration: true, material: true }),
    spell(1, 'Comando', { notes: 'Uma palavra: “Ajoelhe!”' }),
    spell(1, 'Curar Ferimentos', { range: 'Toque' }),
    spell(2, 'Auxílio', { material: true, range: '9 m' }),
    spell(2, 'Arma Mágica', { castingTime: '1 ação bônus', concentration: true, range: 'Toque' }),
  ],
  concentrating: true,
  heroicInspiration: true,
  avatarAssetId: isoldeAvatar,
  appearance: 'Alta, cabelos ruivos presos numa trança de marinheira, armadura de placas com o farol de Porto Salgado gravado no peitoral.',
  description: 'Filha do faroleiro. Fez o juramento na noite em que o farol se apagou e não vai descansar até acendê-lo de novo.',
  languages: 'Comum, Celestial e Aquan',
  equipment: 'Armadura de placas\nEscudo com o brasão do farol\nEspada longa\n4 azagaias\nSímbolo sagrado (amuleto)\nKit de explorador\nCorda de cânhamo (15 m)',
  attunedItems: ['Amuleto da Maré Serena'],
  coins: { cp: 12, sp: 48, ep: 0, gp: 215, pp: 3 },
});

const kaelScores = { strength: 18, dexterity: 14, constitution: 16, intelligence: 8, wisdom: 12, charisma: 10 };
const kael = createCharacter(coroa, {
  ownerId: tiago.id,
  name: 'Kael Ferro-Rubro',
  race: 'Draconato (Vermelho)',
  class: 'Bárbaro',
  subclass: 'Caminho do Berserker',
  level: 6,
  background: 'Marinheiro',
  alignment: 'Caótico e Bom',
  experience: 14500,
  abilityScores: kaelScores,
  hp: 67,
  hpCurrent: 0,
  ac: 15,
  speed: 12,
  hitDie: 12,
  skills: ['athletics', 'intimidation', 'survival', 'perception'],
  saves: ['strength', 'constitution'],
  armorTraining: ['light', 'medium', 'shields'],
  weaponProficiencies: 'Armas Simples e Marciais',
  toolProficiencies: 'Ferramentas de navegador, veículos aquáticos',
  attacks: [
    weapon('Machado grande', 7, '1d12+4', 'Cortante', 'Pesado, duas mãos. +2 em fúria'),
    weapon('Machadinha', 7, '1d6+4', 'Cortante', 'Arremesso 6/18 m'),
    saveAttack('Sopro de Fogo', 13, 'dexterity', '3d10', 'Ígneo', 'Cone de 4,5 m'),
  ],
  features: ['Fúria (4/descanso longo)', 'Defesa sem Armadura', 'Ataque Descuidado', 'Sentido de Perigo', 'Ataque Extra', 'Movimento Rápido', 'Frenesi'],
  speciesTraits: ['Ancestral Dracônico (Vermelho)', 'Resistência a Dano Ígneo', 'Visão no Escuro'],
  feats: ['Duro na Queda'],
  conditions: [{ condition: 'unconscious' }, { condition: 'prone' }],
  deathSaves: { successes: 1, failures: 2 },
  avatarAssetId: kaelAvatar,
  description: 'Ex-arpoador do navio Gaivota Rubra. Perdeu o navio para os sahuagin e quer a cabeça da sacerdotisa deles.',
  languages: 'Comum e Dracônico',
  equipment: 'Machado grande\n2 machadinhas\nArpão do Gaivota Rubra (troféu)\nKit de explorador',
  coins: { cp: 0, sp: 3, ep: 0, gp: 27, pp: 0 },
});

const nymScores = { strength: 8, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 18, charisma: 10 };
const nym = createCharacter(coroa, {
  ownerId: camila.id,
  name: 'Nym Folhaclara',
  race: 'Halfling Pés-Leves',
  class: 'Druida',
  subclass: 'Círculo da Lua',
  level: 6,
  size: 'small',
  background: 'Eremita',
  alignment: 'Neutra',
  experience: 14500,
  abilityScores: nymScores,
  hp: 45,
  hpCurrent: 22,
  hpTemp: 5,
  ac: 14,
  speed: 7.5,
  hitDie: 8,
  hitDiceSpent: 1,
  skills: ['medicine', 'nature', 'animalHandling', 'perception', 'survival'],
  expertise: ['nature'],
  saves: ['intelligence', 'wisdom'],
  armorTraining: ['light', 'shields'],
  weaponProficiencies: 'Armas Simples',
  toolProficiencies: 'Kit de herbalismo',
  attacks: [weapon('Cimitarra', 4, '1d6+2', 'Cortante', 'Acuidade, leve'), saveAttack('Produzir Chamas', 15, 'dexterity', '2d8', 'Ígneo', 'Arremesso 9 m')],
  features: ['Druídico', 'Forma Selvagem (2 usos)', 'Formas de Combate', 'Ataque Primal', 'Formas do Círculo (ND 2)'],
  speciesTraits: ['Sortuda', 'Corajosa', 'Agilidade Halfling', 'Furtividade Natural'],
  feats: ['Curandeira'],
  spellcastingAbility: 'wisdom',
  spellSlots: slots([4, 4], [3, 2], [3, 1]),
  spells: [
    spell(0, 'Bordão Místico', { castingTime: '1 ação bônus', range: 'Toque', material: true }),
    spell(0, 'Orientação', { range: 'Toque', concentration: true }),
    spell(0, 'Produzir Chamas', { castingTime: '1 ação bônus', range: 'Pessoal' }),
    spell(1, 'Bom Fruto', { material: true, range: 'Toque' }),
    spell(1, 'Onda Trovejante', { range: 'Pessoal (cubo de 4,5 m)' }),
    spell(1, 'Fogo das Fadas', { concentration: true, range: '18 m' }),
    spell(1, 'Detectar Magia', { ritual: true, concentration: true, range: 'Pessoal' }),
    spell(2, 'Pele de Árvore', { concentration: true, range: 'Toque', notes: 'CA mínima 16' }),
    spell(2, 'Esfera Flamejante', { concentration: true, material: true }),
    spell(3, 'Convocar Animais', { concentration: true, range: '18 m' }),
    spell(3, 'Respirar na Água', { ritual: true, range: '9 m', material: true }),
  ],
  conditions: [{ condition: 'poisoned', roundsLeft: 2 }],
  avatarAssetId: nymAvatar,
  appearance: 'Cabelos verdes trançados com algas secas, olhos dourados de coruja. Sempre cheira a sal e hortelã.',
  description: 'Viveu vinte anos sozinha nas dunas de Porto Salgado. Os golfinhos contaram a ela que o mar está doente.',
  languages: 'Comum, Halfling, Druídico e Silvestre',
  equipment: 'Armadura de couro\nEscudo de madeira\nCimitarra\nFoco druídico (galho de mangue)\nKit de herbalismo\nBolsa de componentes',
  coins: { cp: 85, sp: 20, ep: 4, gp: 61, pp: 0 },
});

const BART = 'Sir Bartolomeu Valdemar Albuquerque de Montenegro III, o Desatento';
const bartScores = { strength: 8, dexterity: 15, constitution: 13, intelligence: 18, wisdom: 12, charisma: 10 };
const bart = createCharacter(coroa, {
  ownerId: joaquim.id,
  name: BART,
  race: 'Gnomo da Floresta',
  class: 'Mago',
  subclass: 'Escola de Evocação',
  level: 6,
  size: 'small',
  background: 'Sábio',
  alignment: 'Neutro e Bom',
  experience: 14500,
  abilityScores: bartScores,
  hp: 38,
  hpCurrent: 38,
  ac: 12,
  speed: 7.5,
  hitDie: 6,
  skills: ['arcana', 'history', 'investigation', 'religion'],
  expertise: ['arcana'],
  saves: ['intelligence', 'wisdom'],
  weaponProficiencies: 'Armas Simples',
  toolProficiencies: 'Ferramentas de funileiro, ferramentas de alquimista',
  attacks: [
    weapon('Adaga', 4, '1d4+2', 'Perfurante', 'Acuidade, arremesso 6/18 m'),
    weapon('Raio de Fogo', 7, '2d10', 'Ígneo', 'Truque, 36 m'),
    saveAttack('Bola de Fogo', 15, 'dexterity', '8d6', 'Ígneo', 'Esfera de 6 m, 45 m'),
  ],
  features: ['Recuperação Arcana', 'Grimório', 'Esculpir Magias', 'Truque Potente', 'Erudito (Arcanismo)'],
  speciesTraits: ['Esperteza Gnômica', 'Ilusão Menor', 'Falar com Bestas Pequenas'],
  feats: ['Alerta', 'Conjurador de Guerra'],
  spellcastingAbility: 'intelligence',
  spellSlots: slots([4, 3], [3, 3], [3, 2]),
  spells: [
    spell(0, 'Raio de Fogo', { range: '36 m' }),
    spell(0, 'Mão Mágica', { range: '9 m' }),
    spell(0, 'Prestidigitação', { range: '3 m' }),
    spell(0, 'Mensagem', { range: '36 m', material: true }),
    spell(1, 'Escudo', { castingTime: '1 reação', range: 'Pessoal', notes: '+5 de CA até o início do próximo turno' }),
    spell(1, 'Mísseis Mágicos', { range: '36 m', notes: '3 dardos de 1d4+1' }),
    spell(1, 'Detectar Magia', { ritual: true, concentration: true, range: 'Pessoal' }),
    spell(1, 'Encontrar Familiar', { ritual: true, castingTime: '1 hora', material: true, range: '3 m' }),
    spell(2, 'Passo Nebuloso', { castingTime: '1 ação bônus', range: 'Pessoal' }),
    spell(2, 'Teia', { concentration: true, material: true, range: '18 m' }),
    spell(3, 'Bola de Fogo', { material: true, range: '45 m' }),
    spell(3, 'Contramágica', { castingTime: '1 reação', range: '18 m' }),
    spell(3, 'Relâmpago', { material: true, range: 'Pessoal (linha de 30 m)' }),
  ],
  heroicInspiration: true,
  appearance: 'Um gnomo de um metro de altura com um chapéu de dois metros. Os óculos ficam sempre na testa, nunca nos olhos.',
  description: 'Herdeiro de uma família nobre que ninguém mais lembra. Carrega o grimório num baú com pernas que o segue (às vezes).',
  languages: 'Comum, Gnômico, Élfico, Dracônico, Aquan e Primordial',
  equipment: 'Grimório (encadernado em couro de enguia)\nBordão arcano\nAdaga\nBolsa de componentes\nKit de erudito\n3 frascos de tinta\nPena de grifo',
  attunedItems: ['Anel de Proteção', 'Varinha de Mísseis Mágicos'],
  coins: { cp: 3, sp: 7, ep: 0, gp: 412, pp: 10 },
});

createCharacter(coroa, {
  ownerId: tiago.id,
  name: 'Orrin, o Breve',
  race: 'Humano',
  class: 'Guerreiro',
  level: 2,
  abilityScores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 12 },
  hp: 20,
  hpCurrent: 0,
  ac: 16,
  hitDie: 10,
  active: false,
  attacks: [weapon('Espada curta', 5, '1d6+3', 'Perfurante')],
  features: ['Retomar o Fôlego', 'Surto de Ação'],
  deathSaves: { successes: 0, failures: 3 },
  description: 'Morreu no primeiro dia, ao abrir a porta errada do farol. Sua bota direita ainda está lá.',
});

const coroaBestiary = createStatblocks(coroa, [
  {
    name: 'Sahuagin',
    size: 'medium',
    creatureType: 'Humanoide (sahuagin)',
    challengeRating: '1/2',
    ac: 12,
    hpAverage: 22,
    hpFormula: '4d8+4',
    speed: '9 m, natação 12 m',
    abilityScores: { strength: 13, dexterity: 11, constitution: 12, intelligence: 12, wisdom: 13, charisma: 9 },
    attacksPerAction: 2,
    attacks: [weapon('Mordida', 3, '1d4+1', 'Perfurante'), weapon('Garras', 3, '1d4+1', 'Cortante'), weapon('Lança', 3, '1d6+1', 'Perfurante', 'Arremesso 6/18 m')],
    traits: 'Frenesi Sanguinário: vantagem em ataques corpo a corpo contra criaturas sem todos os PV.\nAnfíbio limitado: respira ar por 4 horas.\nTelepatia de Tubarão.',
    actions: 'Ataques Múltiplos: dois ataques corpo a corpo, um de mordida e um de garras ou lança.',
  },
  {
    name: 'Sacerdotisa Sahuagin',
    size: 'medium',
    creatureType: 'Humanoide (sahuagin)',
    challengeRating: '2',
    ac: 12,
    hpAverage: 33,
    hpFormula: '6d8+6',
    speed: '9 m, natação 12 m',
    initiativeBonus: 1,
    abilityScores: { strength: 13, dexterity: 11, constitution: 12, intelligence: 12, wisdom: 14, charisma: 13 },
    attacksPerAction: 2,
    attacks: [weapon('Mordida', 3, '1d4+1', 'Perfurante'), weapon('Garras', 3, '1d4+1', 'Cortante'), saveAttack('Arma Espiritual', 12, 'wisdom', '1d8+2', 'Força')],
    traits: 'Conjuração (Sabedoria, CD 12): Guiança, Taumaturgia; 1º: Bênção, Detectar Magia, Sono; 2º: Arma Espiritual, Imobilizar Pessoa; 3º: Maldição, Clarividência.',
    actions: 'Ataques Múltiplos: um ataque de mordida e um de garras.',
    reactions: 'Prece à Tubarã-Mãe: quando um sahuagin a 9 m cai a 0 PV, ele faz um ataque de mordida antes de cair.',
  },
  {
    name: 'Tubarão-Caçador',
    size: 'large',
    creatureType: 'Fera',
    challengeRating: '2',
    ac: 12,
    hpAverage: 45,
    hpFormula: '6d10+12',
    speed: 'natação 12 m',
    abilityScores: { strength: 18, dexterity: 13, constitution: 15, intelligence: 1, wisdom: 10, charisma: 4 },
    attacks: [weapon('Mordida', 6, '2d8+4', 'Perfurante')],
    traits: 'Frenesi Sanguinário.\nRespiração Aquática.',
    imageAssetId: sharkImage,
  },
  {
    name: 'Bruxa do Mar',
    size: 'medium',
    creatureType: 'Fada',
    challengeRating: '2',
    ac: 14,
    hpAverage: 52,
    hpFormula: '7d8+21',
    speed: '9 m, natação 12 m',
    abilityScores: { strength: 16, dexterity: 13, constitution: 16, intelligence: 12, wisdom: 12, charisma: 13 },
    attacks: [weapon('Garras', 5, '2d6+3', 'Cortante'), saveAttack('Olhar Mortal', 11, 'wisdom', '', '', 'Amedrontado; falha por 5+: cai a 0 PV')],
    traits: 'Anfíbia.\nAparência Horripilante: quem começa o turno a 9 m e a vê faz salvaguarda de Sabedoria CD 11 ou fica Amedrontado por 1 minuto.',
    actions: 'Aparência Ilusória: cobre-se com uma ilusão de mulher jovem e bela.',
    imageAssetId: seaHagImage,
  },
  {
    name: 'Afogado',
    size: 'medium',
    creatureType: 'Morto-vivo',
    challengeRating: '1',
    ac: 10,
    hpAverage: 30,
    hpFormula: '4d8+12',
    speed: '6 m, natação 9 m',
    abilityScores: { strength: 15, dexterity: 8, constitution: 16, intelligence: 3, wisdom: 6, charisma: 5 },
    attacks: [weapon('Pancada encharcada', 4, '1d8+2', 'Concussão', 'Alvo agarrado (CD 12)')],
    traits: 'Fortitude dos Mortos-Vivos: ao cair a 0 PV, salvaguarda de Constituição CD 5 + dano; sucesso fica com 1 PV (não vale contra radiante ou crítico).',
  },
  {
    name: 'Kuo-toa Chicoteador',
    size: 'medium',
    creatureType: 'Humanoide (kuo-toa)',
    challengeRating: '1',
    ac: 11,
    hpAverage: 65,
    hpFormula: '10d8+20',
    speed: '9 m, natação 9 m',
    abilityScores: { strength: 14, dexterity: 10, constitution: 14, intelligence: 12, wisdom: 14, charisma: 11 },
    attacksPerAction: 2,
    attacks: [weapon('Cajado-pinça', 4, '1d6+2', 'Concussão', 'Alcance 3 m; agarrar CD 14'), weapon('Mordida', 4, '1d4+2', 'Perfurante')],
    traits: 'Escorregadio: vantagem para escapar de agarrões.\nSensibilidade à Luz Solar.',
  },
]);

const sahuagin = coroaBestiary.get('Sahuagin')!;
const priestess = coroaBestiary.get('Sacerdotisa Sahuagin')!;
const shark = coroaBestiary.get('Tubarão-Caçador')!;
const seaHag = coroaBestiary.get('Bruxa do Mar')!;
const drowned = coroaBestiary.get('Afogado')!;

// The fight in progress: round 3, a bit of everything on the table.
const assaultId = randomUUID();
db.insert(encounters)
  .values({ id: assaultId, campaignId: coroa, name: 'Assalto ao Farol Afogado', status: 'active', round: 3, version: 42, startedAt: new Date(Date.now() - 40 * 60_000) })
  .run();
const feedA = feedClock(coroa, 180);
const sahuaginAttackEvent = randomUUID();

const isoldeFighter = addCharacterFighter(assaultId, {
  characterId: isolde,
  name: 'Isolde Ventomar',
  dexterity: isoldeScores.dexterity,
  initiative: 12,
  reminders: [{ id: randomUUID(), kind: 'concentration', dc: 10 }],
});
const kaelFighter = addCharacterFighter(assaultId, {
  characterId: kael,
  name: 'Kael Ferro-Rubro',
  dexterity: kaelScores.dexterity,
  initiative: 17,
  reminders: [{ id: randomUUID(), kind: 'deathFailure' }],
});
const nymFighter = addCharacterFighter(assaultId, { characterId: nym, name: 'Nym Folhaclara', dexterity: nymScores.dexterity, size: 'small', initiative: 9 });
addCharacterFighter(assaultId, {
  characterId: bart,
  name: BART,
  dexterity: bartScores.dexterity,
  size: 'small',
  initiative: 21,
});
const sahuagin1 = addCreatureFighter(assaultId, {
  creature: sahuagin,
  name: 'Sahuagin 1',
  hpCurrent: 9,
  initiative: 15,
  conditions: [{ condition: 'prone' }],
  reminders: [
    {
      id: randomUUID(),
      kind: 'pendingDamage',
      amount: 11,
      damageType: 'Cortante',
      critical: false,
      attackerName: 'Isolde Ventomar',
      attackName: 'Espada longa',
      eventId: sahuaginAttackEvent,
      secret: false,
    },
  ],
});
const sahuagin2 = addCreatureFighter(assaultId, { creature: sahuagin, name: 'Sahuagin 2', hpCurrent: 0, initiative: 15 });
const sahuagin3 = addCreatureFighter(assaultId, { creature: sahuagin, name: 'Sahuagin 3', initiative: 8, conditions: [{ condition: 'restrained', roundsLeft: 4 }] });
const priestessFighter = addCreatureFighter(assaultId, {
  creature: priestess,
  name: 'Sacerdotisa Sahuagin',
  hpCurrent: 19,
  initiative: 14,
  concentrating: true,
  conditions: [{ condition: 'frightened', roundsLeft: 1 }],
});
const sharkFighter = addCreatureFighter(assaultId, { creature: shark, name: 'Tubarão-Caçador', hidden: true, initiative: 11 });
const merrowId = randomUUID();
db.insert(combatants)
  .values({
    id: merrowId,
    encounterId: assaultId,
    source: 'manual',
    name: 'Capitã Merrow (aliada)',
    ac: 13,
    hpMax: 27,
    hpCurrent: 27,
    hpTemp: 0,
    conditions: [{ condition: 'exhaustion', level: 2 }],
    concentrating: false,
    initiative: 6,
    attacks: [weapon('Sabre', 4, '1d6+2', 'Cortante')],
  })
  .run();

// The priestess' turn, half spent: the action is gone, the bonus action is not.
db.update(encounters).set({ activeCombatantId: priestessFighter }).where(eq(encounters.id, assaultId)).run();
db.update(combatants)
  .set({ ...freshTurn(), actionUsed: true, attacksLeft: 0, movementUsed: 4.5 })
  .where(eq(combatants.id, priestessFighter))
  .run();

// A fight that never started and one that ended last session.
const lairId = randomUUID();
db.insert(encounters).values({ id: lairId, campaignId: coroa, name: 'O Covil da Bruxa do Mar' }).run();
for (const [characterId, name, dexterity] of [
  [isolde, 'Isolde Ventomar', isoldeScores.dexterity],
  [nym, 'Nym Folhaclara', nymScores.dexterity],
] as const) {
  addCharacterFighter(lairId, { characterId, name, dexterity });
}
addCreatureFighter(lairId, { creature: seaHag, name: 'Bruxa do Mar' });
addCreatureFighter(lairId, { creature: drowned, name: 'Afogado 1' });
addCreatureFighter(lairId, { creature: drowned, name: 'Afogado 2' });
addCreatureFighter(lairId, { creature: drowned, name: 'Afogado 3', hidden: true });

const tavernId = randomUUID();
db.insert(encounters)
  .values({
    id: tavernId,
    campaignId: coroa,
    name: 'Briga na Taverna do Arpão Torto',
    status: 'ended',
    round: 4,
    startedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000),
    endedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000 + 25 * 60_000),
  })
  .run();

// --- Feed of campaign 1 ----------------------------------------------------

const ref = (combatantId: string, name: string, source: 'character' | 'statblock' | 'manual') => ({ encounterId: assaultId, combatantId, name, source });

post(feedA, you.id, 'combat.started', { kind: 'combat.started', encounterId: tavernId, encounterName: 'Briga na Taverna do Arpão Torto' });
post(feedA, tiago.id, 'roll', d20(19, 4, { rollKind: 'skill', skill: 'athletics', ability: 'strength', characterId: kael, characterName: 'Kael Ferro-Rubro' }));
post(feedA, you.id, 'combat.ended', {
  kind: 'combat.ended',
  encounterId: tavernId,
  encounterName: 'Briga na Taverna do Arpão Torto',
  rounds: 4,
  defeated: [
    { name: 'Bandido 1', hidden: false },
    { name: 'Bandido 2', hidden: false },
    { name: 'Espião do Cais', hidden: true },
  ],
});
post(feedA, camila.id, 'roll', d20(14, 7, { rollKind: 'skill', skill: 'nature', ability: 'intelligence', characterId: nym, characterName: 'Nym Folhaclara' }));
post(feedA, joaquim.id, 'roll', withAdvantage(17, 4, 6, { rollKind: 'skill', skill: 'arcana', ability: 'intelligence', characterId: bart, characterName: BART }));
post(feedA, you.id, 'roll', free('1d100', [{ value: 87, sides: 100 }], 0), true);
post(feedA, marina.id, 'roll', d20(1, 5, { rollKind: 'save', ability: 'wisdom', characterId: isolde, characterName: 'Isolde Ventomar' }));
post(feedA, you.id, 'combat.started', { kind: 'combat.started', encounterId: assaultId, encounterName: 'Assalto ao Farol Afogado' });
post(feedA, joaquim.id, 'roll', d20(18, 3, { rollKind: 'initiative', ability: 'dexterity', characterId: bart, characterName: BART }));
post(feedA, tiago.id, 'roll', d20(15, 2, { rollKind: 'initiative', ability: 'dexterity', characterId: kael, characterName: 'Kael Ferro-Rubro' }));
post(feedA, marina.id, 'roll', d20(12, 0, { rollKind: 'initiative', ability: 'dexterity', characterId: isolde, characterName: 'Isolde Ventomar' }));
post(feedA, camila.id, 'roll', d20(7, 2, { rollKind: 'initiative', ability: 'dexterity', characterId: nym, characterName: 'Nym Folhaclara' }));
post(feedA, you.id, 'roll', d20(13, 1, { rollKind: 'initiative', ability: 'dexterity' }), true);
post(feedA, joaquim.id, 'spell.cast', { kind: 'spell.cast', characterId: bart, characterName: BART, spellName: 'Bola de Fogo', spellLevel: 3, circle: 3, concentration: false });
post(feedA, joaquim.id, 'roll', {
  ...free('8d6', [5, 6, 2, 4, 6, 3, 1, 5].map((value) => ({ value, sides: 6 })), 0),
  rollKind: 'attack',
  characterId: bart,
  characterName: BART,
  attackName: 'Bola de Fogo',
  save: { dc: 15, ability: 'dexterity' },
  attackerSource: 'character',
});
post(feedA, you.id, 'combat.defeated', { kind: 'combat.defeated', ...ref(sahuagin2, 'Sahuagin 2', 'statblock'), amount: 32, hpCurrent: 0, hpMax: 22, band: 'defeated' });
post(feedA, you.id, 'combat.damage', { kind: 'combat.damage', ...ref(sahuagin1, 'Sahuagin 1', 'statblock'), amount: 13, hpCurrent: 9, hpMax: 22, band: healthBand(9, 22) });
post(feedA, tiago.id, 'roll', {
  ...d20(20, 7, { rollKind: 'attack', characterId: kael, characterName: 'Kael Ferro-Rubro', attackName: 'Machado grande' }),
  critical: true,
  attackerSource: 'character',
  target: { combatantId: priestessFighter, name: 'Sacerdotisa Sahuagin', source: 'monster', hit: true },
  damage: damageRoll('2d12+6', [9, 11], 12, 6, 'Cortante'),
});
post(feedA, you.id, 'combat.damage', { kind: 'combat.damage', ...ref(priestessFighter, 'Sacerdotisa Sahuagin', 'statblock'), amount: 14, hpCurrent: 19, hpMax: 33, band: healthBand(19, 33) });
post(feedA, you.id, 'roll', {
  ...d20(16, 6, { rollKind: 'attack', attackName: 'Mordida' }),
  attackerSource: 'monster',
  target: { combatantId: kaelFighter, name: 'Kael Ferro-Rubro', source: 'character', hit: true, ac: 15 },
  damage: damageRoll('2d8+4', [7, 8], 8, 4, 'Perfurante'),
}, true);
post(feedA, you.id, 'combat.damage', { kind: 'combat.damage', ...ref(kaelFighter, 'Kael Ferro-Rubro', 'character'), amount: 19, hpCurrent: 0, hpMax: 67, band: 'defeated', fell: true });
post(feedA, you.id, 'combat.condition', { kind: 'combat.condition', ...ref(kaelFighter, 'Kael Ferro-Rubro', 'character'), action: 'applied', condition: { condition: 'unconscious' } });
post(feedA, you.id, 'combat.damage', { kind: 'combat.damage', ...ref(isoldeFighter, 'Isolde Ventomar', 'character'), amount: 12, hpCurrent: 31, hpMax: 58, band: healthBand(31, 58) });
post(feedA, camila.id, 'spell.cast', { kind: 'spell.cast', characterId: nym, characterName: 'Nym Folhaclara', spellName: 'Fogo das Fadas', spellLevel: 1, circle: 1, concentration: true });
post(feedA, you.id, 'combat.condition', { kind: 'combat.condition', ...ref(nymFighter, 'Nym Folhaclara', 'character'), action: 'applied', condition: { condition: 'poisoned', roundsLeft: 3 } });
post(feedA, tiago.id, 'combat.deathSave', { kind: 'combat.deathSave', ...ref(kaelFighter, 'Kael Ferro-Rubro', 'character'), d20: 14, saves: { successes: 1, failures: 1 }, outcome: 'pending' });
post(feedA, tiago.id, 'combat.deathSave', { kind: 'combat.deathSave', ...ref(kaelFighter, 'Kael Ferro-Rubro', 'character'), d20: 1, saves: { successes: 1, failures: 2 }, outcome: 'pending' });
post(feedA, marina.id, 'spell.cast', { kind: 'spell.cast', characterId: isolde, characterName: 'Isolde Ventomar', spellName: 'Bênção', spellLevel: 1, circle: 1, concentration: true });
post(feedA, marina.id, 'combat.heal', { kind: 'combat.heal', ...ref(nymFighter, 'Nym Folhaclara', 'character'), amount: 10, hpCurrent: 22, hpMax: 45, band: healthBand(22, 45) });
post(feedA, joaquim.id, 'roll', {
  ...d20(1, 7, { rollKind: 'spellAttack', characterId: bart, characterName: BART, attackName: 'Raio de Fogo' }),
  attackerSource: 'character',
  target: { combatantId: sahuagin3, name: 'Sahuagin 3', source: 'monster', hit: false },
});
db.insert(sessionEvents)
  .values({
    id: sahuaginAttackEvent,
    campaignId: coroa,
    userId: marina.id,
    type: 'roll',
    secret: false,
    createdAt: new Date((feedA.at += 60_000)),
    payload: {
      ...d20(17, 7, { rollKind: 'attack', characterId: isolde, characterName: 'Isolde Ventomar', attackName: 'Espada longa' }),
      attackerSource: 'character',
      target: { combatantId: sahuagin1, name: 'Sahuagin 1', source: 'monster', hit: true },
      damage: damageRoll('1d8+4', [7], 8, 4, 'Cortante'),
    } satisfies RollPayload,
  })
  .run();
post(feedA, you.id, 'combat.condition', { kind: 'combat.condition', ...ref(priestessFighter, 'Sacerdotisa Sahuagin', 'statblock'), action: 'applied', condition: { condition: 'frightened', roundsLeft: 1 } });
post(feedA, you.id, 'roll', {
  ...free('1d4+1', [{ value: 3, sides: 4 }], 1),
  rollKind: 'attack',
  attackName: 'Garras',
  attackerSource: 'monster',
  target: { combatantId: merrowId, name: 'Capitã Merrow (aliada)', source: 'monster', hit: true, ac: 13 },
}, true);

// --- Scenes of campaign 1 --------------------------------------------------

const cellCenter = (column: number, row: number, cell: number) => ({ x: (column + 0.5) * cell, y: (row + 0.5) * cell });

function createScene(campaignId: string, name: string, map: { id: string; width: number; height: number }, extra: Partial<typeof scenes.$inferInsert> = {}) {
  const id = randomUUID();
  db.insert(scenes)
    .values({ id, campaignId, name, mapAssetId: map.id, mapWidth: map.width, mapHeight: map.height, gridCellSize: map.width / 30, ...extra })
    .run();
  return { id, cell: map.width / 30 };
}

type TokenInput = Omit<typeof tokens.$inferInsert, 'id' | 'sceneId' | 'x' | 'y'> & { at: [number, number] };

function placeTokens(scene: { id: string; cell: number }, list: TokenInput[]) {
  for (const { at, ...token } of list) {
    db.insert(tokens).values({ id: randomUUID(), sceneId: scene.id, ...token, ...cellCenter(at[0], at[1], scene.cell) }).run();
  }
}

const lighthouse = createScene(coroa, 'Farol Afogado — andar inferior', await storeMap(coroa, you.id, dungeonSvg()));
placeTokens(lighthouse, [
  { kind: 'character', characterId: isolde, at: [17, 6] },
  { kind: 'character', characterId: kael, at: [16, 4] },
  { kind: 'character', characterId: nym, at: [12, 4] },
  { kind: 'character', characterId: bart, at: [11, 5] },
  { kind: 'combatant', combatantId: sahuagin1, at: [17, 3] },
  { kind: 'combatant', combatantId: sahuagin2, at: [21, 6] },
  { kind: 'combatant', combatantId: sahuagin3, at: [22, 2] },
  { kind: 'combatant', combatantId: priestessFighter, at: [20, 4] },
  { kind: 'combatant', combatantId: sharkFighter, at: [19, 13] },
  { kind: 'combatant', combatantId: merrowId, at: [15, 7] },
  { kind: 'free', label: 'Barril de pólvora', size: 'small', at: [23, 16] },
  { kind: 'free', label: 'Baú do faroleiro', size: 'small', statblockId: null, at: [4, 13] },
  { kind: 'free', label: 'Armadilha de rede', size: 'medium', hidden: true, at: [6, 9] },
]);
db.update(campaigns).set({ activeSceneId: lighthouse.id }).where(eq(campaigns.id, coroa)).run();

const coast = createScene(coroa, 'Costa dos Naufrágios', await storeMap(coroa, you.id, coastSvg()), { gridOpacity: 0.3, snapToGrid: false });
placeTokens(coast, [
  { kind: 'character', characterId: isolde, at: [8, 7] },
  { kind: 'character', characterId: nym, at: [9, 7] },
  { kind: 'free', label: 'Bruxa do Mar (disfarçada)', size: 'medium', statblockId: seaHag.id, hidden: true, at: [20, 15] },
]);

// ===========================================================================
// Campaign 2: you are a player.
// ===========================================================================

const ruinas = createCampaign(
  CAMPAIGN_IDS.ruinas,
  "Ruínas de Vel'Kahar",
  'Mil anos atrás, o império de Vel\'Kahar afundou na areia numa única noite. Agora uma tempestade de areia descobriu as torres da capital, e cada casa nobre de Myrr mandou seus aventureiros atrás do Cetro do Sol Poente.',
  marina,
  [you, tiago, camila],
);

const aureliaAvatar = await storeAvatar(ruinas, you.id, 'Aurelia Lumen', 45);
const bromAvatar = await storeAvatar(ruinas, tiago.id, 'Brom Pedrafunda', 25);
const wightImage = await storeAvatar(ruinas, marina.id, 'Espectro', 270);

const aureliaScores = { strength: 12, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 17, charisma: 14 };
const aurelia = createCharacter(ruinas, {
  ownerId: you.id,
  name: 'Aurelia Lumen',
  race: 'Aasimar',
  class: 'Clériga',
  subclass: 'Domínio da Luz',
  level: 5,
  background: 'Acólita',
  alignment: 'Neutra e Boa',
  experience: 7200,
  abilityScores: aureliaScores,
  hp: 38,
  hpCurrent: 27,
  hpTemp: 0,
  ac: 18,
  shield: true,
  speed: 9,
  hitDie: 8,
  hitDiceSpent: 1,
  skills: ['insight', 'medicine', 'religion', 'persuasion'],
  saves: ['wisdom', 'charisma'],
  armorTraining: ['light', 'medium', 'shields'],
  weaponProficiencies: 'Armas Simples',
  toolProficiencies: 'Kit de caligrafia',
  attacks: [
    weapon('Maça', 4, '1d6+1', 'Concussão'),
    saveAttack('Chama Sagrada', 14, 'dexterity', '2d8', 'Radiante', 'Ignora cobertura, 18 m', 'none'),
    weapon('Besta leve', 3, '1d8', 'Perfurante', 'Munição 24/96 m'),
  ],
  features: ['Canalizar Divindade (2/descanso)', 'Labareda Protetora (3/dia)', 'Expulsar Mortos-Vivos', 'Destruir Mortos-Vivos (ND 1/2)', 'Radiância da Aurora'],
  speciesTraits: ['Resistência Celestial', 'Mãos Curativas', 'Portadora da Luz', 'Revelação Celestial'],
  feats: ['Sortudo'],
  spellcastingAbility: 'wisdom',
  spellSlots: slots([4, 2], [3, 1], [2, 0]),
  spells: [
    spell(0, 'Chama Sagrada', { range: '18 m' }),
    spell(0, 'Luz', { range: 'Toque', material: true }),
    spell(0, 'Taumaturgia', { range: '9 m' }),
    spell(0, 'Orientação', { range: 'Toque', concentration: true }),
    spell(1, 'Curar Ferimentos', { range: 'Toque' }),
    spell(1, 'Mãos Ardentes', { range: 'Pessoal (cone de 4,5 m)', notes: 'Magia de domínio' }),
    spell(1, 'Fogo das Fadas', { concentration: true, notes: 'Magia de domínio' }),
    spell(1, 'Bênção', { concentration: true, material: true }),
    spell(1, 'Palavra Curativa', { castingTime: '1 ação bônus', range: '18 m' }),
    spell(2, 'Esfera Flamejante', { concentration: true, material: true, notes: 'Magia de domínio' }),
    spell(2, 'Raio Ardente', { notes: 'Magia de domínio' }),
    spell(2, 'Restauração Menor', { range: 'Toque' }),
    spell(3, 'Espíritos Guardiões', { concentration: true, material: true, range: 'Pessoal (4,5 m)' }),
    spell(3, 'Luz do Dia', { range: '18 m', notes: 'Magia de domínio' }),
    spell(3, 'Revivificar', { material: true, range: 'Toque', notes: 'Diamante de 300 po' }),
  ],
  heroicInspiration: true,
  avatarAssetId: aureliaAvatar,
  appearance: 'Pele morena com sardas que brilham fracamente no escuro. Usa um véu dourado e um escudo com o sol nascente.',
  description: 'Foi encontrada bebê nos degraus do Templo da Aurora, numa manhã sem sol. Acredita que o Cetro do Sol Poente é a razão de ter nascido.',
  languages: 'Comum, Celestial e Primordial',
  equipment: 'Cota de escamas\nEscudo com o sol nascente\nMaça\nBesta leve e 20 virotes\nSímbolo sagrado (emblema no escudo)\nKit de sacerdote\nDiamante (300 po)',
  attunedItems: ['Véu do Amanhecer'],
  coins: { cp: 40, sp: 22, ep: 0, gp: 136, pp: 1 },
});

createCharacter(ruinas, {
  ownerId: you.id,
  name: 'Fennick Dedos-Leves',
  race: 'Halfling',
  class: 'Ladino',
  level: 2,
  size: 'small',
  abilityScores: { strength: 8, dexterity: 17, constitution: 12, intelligence: 13, wisdom: 10, charisma: 14 },
  hp: 15,
  ac: 14,
  active: false,
  skills: ['stealth', 'sleightOfHand', 'deception', 'perception'],
  expertise: ['stealth', 'sleightOfHand'],
  attacks: [weapon('Adaga', 5, '1d4+3', 'Perfurante'), weapon('Arco curto', 5, '1d6+3', 'Perfurante', 'Munição 24/96 m')],
  features: ['Ataque Furtivo 1d6', 'Ação Ardilosa', 'Gíria de Ladrão'],
  description: 'Aposentado depois de roubar a coroa errada. Espera na taverna o dia em que for preciso de novo.',
});

const bromScores = { strength: 17, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 13, charisma: 8 };
const brom = createCharacter(ruinas, {
  ownerId: tiago.id,
  name: 'Brom Pedrafunda',
  race: 'Anão das Montanhas',
  class: 'Guerreiro',
  subclass: 'Mestre de Batalha',
  level: 5,
  background: 'Soldado',
  alignment: 'Leal e Neutro',
  experience: 7200,
  abilityScores: bromScores,
  hp: 49,
  hpCurrent: 49,
  ac: 19,
  shield: true,
  speed: 7.5,
  hitDie: 10,
  skills: ['athletics', 'intimidation', 'perception'],
  saves: ['strength', 'constitution'],
  armorTraining: ['light', 'medium', 'heavy', 'shields'],
  weaponProficiencies: 'Armas Simples e Marciais',
  toolProficiencies: 'Ferramentas de ferreiro',
  attacks: [weapon('Martelo de guerra', 6, '1d8+3', 'Concussão', 'Versátil (1d10)'), weapon('Machadinha', 6, '1d6+3', 'Cortante', 'Arremesso 6/18 m')],
  features: ['Retomar o Fôlego', 'Surto de Ação', 'Manobras (4d8)', 'Ataque Extra'],
  speciesTraits: ['Resiliência Anã', 'Robustez Anã', 'Visão no Escuro'],
  feats: ['Mestre de Armas Pesadas'],
  conditions: [{ condition: 'exhaustion', level: 1 }],
  avatarAssetId: bromAvatar,
  languages: 'Comum e Anão',
  equipment: 'Cota de malha\nEscudo\nMartelo de guerra\n2 machadinhas\nKit de explorador',
  coins: { cp: 0, sp: 12, ep: 0, gp: 54, pp: 0 },
});

const sylvaraScores = { strength: 10, dexterity: 18, constitution: 13, intelligence: 11, wisdom: 15, charisma: 9 };
const sylvara = createCharacter(ruinas, {
  ownerId: camila.id,
  name: 'Sylvara',
  race: 'Elfa da Floresta',
  class: 'Patrulheira',
  subclass: 'Caçadora',
  level: 5,
  background: 'Forasteira',
  alignment: 'Caótica e Boa',
  experience: 7200,
  abilityScores: sylvaraScores,
  hp: 42,
  hpCurrent: 18,
  ac: 16,
  speed: 10.5,
  hitDie: 10,
  skills: ['stealth', 'survival', 'perception', 'nature'],
  saves: ['strength', 'dexterity'],
  armorTraining: ['light', 'medium', 'shields'],
  attacks: [weapon('Arco longo', 9, '1d8+4', 'Perfurante', 'Munição 45/180 m'), weapon('Espada curta', 7, '1d6+4', 'Perfurante')],
  features: ['Inimigo Favorito', 'Explorador Hábil', 'Estilo de Luta: Arquearia', 'Matador de Colossos', 'Ataque Extra'],
  spellcastingAbility: 'wisdom',
  spellSlots: slots([4, 3], [2, 2]),
  spells: [spell(1, 'Marca do Caçador', { castingTime: '1 ação bônus', concentration: true, range: '27 m' }), spell(1, 'Golpe Constritor', { castingTime: '1 ação bônus', concentration: true }), spell(2, 'Passo sem Rastro', { concentration: true, range: 'Pessoal' })],
  concentrating: true,
  conditions: [{ condition: 'poisoned' }],
});

const ruinasBestiary = createStatblocks(ruinas, [
  {
    name: 'Esqueleto',
    size: 'medium',
    creatureType: 'Morto-vivo',
    challengeRating: '1/4',
    ac: 13,
    hpAverage: 13,
    hpFormula: '2d8+4',
    speed: '9 m',
    abilityScores: { strength: 10, dexterity: 14, constitution: 15, intelligence: 6, wisdom: 8, charisma: 5 },
    attacks: [weapon('Espada curta', 4, '1d6+2', 'Perfurante'), weapon('Arco curto', 4, '1d6+2', 'Perfurante', '24/96 m')],
    traits: 'Vulnerável a dano de concussão.',
  },
  {
    name: 'Carniçal',
    size: 'medium',
    creatureType: 'Morto-vivo',
    challengeRating: '1',
    ac: 12,
    hpAverage: 22,
    hpFormula: '5d8',
    speed: '9 m',
    abilityScores: { strength: 13, dexterity: 15, constitution: 10, intelligence: 7, wisdom: 10, charisma: 6 },
    attacks: [weapon('Mordida', 2, '2d6+2', 'Perfurante'), weapon('Garras', 4, '2d4+2', 'Cortante', 'CD 10 Constituição ou Paralisado por 1 minuto')],
  },
  {
    name: 'Espectro',
    size: 'medium',
    creatureType: 'Morto-vivo',
    challengeRating: '3',
    ac: 14,
    hpAverage: 45,
    hpFormula: '6d8+18',
    speed: '9 m',
    abilityScores: { strength: 15, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 13, charisma: 15 },
    attacksPerAction: 2,
    attacks: [weapon('Espada longa', 4, '1d8+2', 'Cortante'), weapon('Toque Drenador', 4, '1d6+2', 'Necrótico', 'PV máximo reduzido no mesmo valor')],
    traits: 'Sensibilidade à Luz Solar.\nResistente a necrótico e a dano de armas não mágicas que não sejam de prata.',
    actions: 'Ataques Múltiplos: dois ataques de espada longa, ou um de espada longa e um Toque Drenador.',
    imageAssetId: wightImage,
  },
]);

const cryptId = randomUUID();
db.insert(encounters).values({ id: cryptId, campaignId: ruinas, name: 'Cripta do Rei Sem Nome' }).run();
addCharacterFighter(cryptId, { characterId: aurelia, name: 'Aurelia Lumen', dexterity: aureliaScores.dexterity });
addCharacterFighter(cryptId, { characterId: brom, name: 'Brom Pedrafunda', dexterity: bromScores.dexterity });
addCharacterFighter(cryptId, { characterId: sylvara, name: 'Sylvara', dexterity: sylvaraScores.dexterity });
const wight = addCreatureFighter(cryptId, { creature: ruinasBestiary.get('Espectro')!, name: 'Espectro', hidden: true });
const skeletons = [1, 2, 3].map((n) => addCreatureFighter(cryptId, { creature: ruinasBestiary.get('Esqueleto')!, name: `Esqueleto ${n}` }));

const hall = createScene(ruinas, 'Salão das Colunas', await storeMap(ruinas, marina.id, cryptSvg()));
placeTokens(hall, [
  { kind: 'character', characterId: aurelia, at: [5, 9] },
  { kind: 'character', characterId: brom, at: [6, 10] },
  { kind: 'character', characterId: sylvara, at: [4, 11] },
  { kind: 'combatant', combatantId: skeletons[0], at: [14, 6] },
  { kind: 'combatant', combatantId: skeletons[1], at: [16, 6] },
  { kind: 'combatant', combatantId: skeletons[2], at: [18, 13] },
  { kind: 'combatant', combatantId: wight, at: [15, 10] },
  { kind: 'free', label: 'Sarcófago', size: 'large', at: [14, 9] },
  { kind: 'free', label: 'Alavanca secreta', size: 'tiny', hidden: true, at: [27, 3] },
]);
db.update(campaigns).set({ activeSceneId: hall.id }).where(eq(campaigns.id, ruinas)).run();

const feedB = feedClock(ruinas, 120);
post(feedB, you.id, 'roll', d20(16, 5, { rollKind: 'skill', skill: 'religion', ability: 'intelligence', characterId: aurelia, characterName: 'Aurelia Lumen' }));
post(feedB, marina.id, 'roll', d20(9, 2, { rollKind: 'check', ability: 'dexterity' }), true);
post(feedB, camila.id, 'roll', withAdvantage(20, 6, 9, { rollKind: 'skill', skill: 'perception', ability: 'wisdom', characterId: sylvara, characterName: 'Sylvara' }));
post(feedB, you.id, 'spell.cast', { kind: 'spell.cast', characterId: aurelia, characterName: 'Aurelia Lumen', spellName: 'Luz', spellLevel: 0, circle: null, concentration: false });
post(feedB, tiago.id, 'roll', d20(3, 6, { rollKind: 'skill', skill: 'athletics', ability: 'strength', characterId: brom, characterName: 'Brom Pedrafunda' }));
post(feedB, you.id, 'spell.cast', { kind: 'spell.cast', characterId: aurelia, characterName: 'Aurelia Lumen', spellName: 'Curar Ferimentos', spellLevel: 1, circle: 1, concentration: false });
post(feedB, you.id, 'roll', free('1d8+3', [{ value: 6, sides: 8 }], 3));
post(feedB, marina.id, 'roll', free('3d6', [4, 2, 6].map((value) => ({ value, sides: 6 })), 0), true);
post(feedB, you.id, 'spell.cast', { kind: 'spell.cast', characterId: aurelia, characterName: 'Aurelia Lumen', spellName: 'Raio Ardente', spellLevel: 2, circle: 2, concentration: false });
post(feedB, you.id, 'roll', d20(11, 5, { rollKind: 'save', ability: 'wisdom', characterId: aurelia, characterName: 'Aurelia Lumen' }));
post(feedB, camila.id, 'roll', free('2d6+4', [{ value: 5, sides: 6 }, { value: 1, sides: 6 }], 4));

// ===========================================================================
// Campaign 3: empty, for the empty states.
// ===========================================================================

createCampaign(CAMPAIGN_IDS.empty, 'Mesa nova (vazia)', '', you, []);

// ---------------------------------------------------------------------------

const session = randomUUID();
db.insert(sessions).values({ id: session, userId: you.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000) }).run();

if (removed > 0) console.log(`${removed} campanha(s) da vitrine anterior removida(s).`);
console.log(`Vitrine pronta para ${you.name}:`);
console.log('  - "A Coroa Afogada" (mestre): combate na rodada 3, encontro em preparação e um encerrado, 2 cenas, bestiário com 6 criaturas.');
console.log(`  - "Ruínas de Vel'Kahar" (jogador): personagem conjuradora completa, outra na galeria, cena aberta.`);
console.log('  - "Mesa nova (vazia)" (mestre): estados vazios.');
console.log(`Cookie qf_session: ${session}`);
