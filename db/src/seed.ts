import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { abilityModifier, generateInviteCode, type AbilityScores, type Attack } from '@quest-fast/shared';
import {
  campaignMembers,
  campaigns,
  characters,
  combatants,
  createDb,
  encounters,
  sessionEvents,
  sessions,
  statblocks,
  users,
} from './index.ts';

/**
 * Sample campaign for development and visual review. It also creates a fixed
 * session, so the interface can be opened without going through Discord.
 * Must not be run in production.
 *
 *   npm run db:seed
 *
 * The session printed at the end works as the `qf_session` cookie.
 */

const db = createDb();

const seedUsers = [
  { discordId: 'seed-master', name: 'Lia Martins', avatarUrl: null },
  { discordId: 'seed-rafael', name: 'Rafael Costa', avatarUrl: null },
  { discordId: 'seed-ana', name: 'Ana Beatriz', avatarUrl: null },
  { discordId: 'seed-pedro', name: 'Pedro Alves', avatarUrl: null },
];

/** Upserts by the unique discordId and returns the stored row, so reruns of
 * the seed reuse existing ids instead of referencing fresh UUIDs. */
function ensureUser(profile: (typeof seedUsers)[number]) {
  db.insert(users)
    .values({ id: randomUUID(), ...profile })
    .onConflictDoNothing()
    .run();
  return db.select().from(users).where(eq(users.discordId, profile.discordId)).get()!;
}

const master = ensureUser(seedUsers[0]);
const players = seedUsers.slice(1).map(ensureUser);

// Sample content stays in Portuguese: it is what the table reads.
const campaign = {
  id: randomUUID(),
  name: 'Ecos de Phandalin',
  description: 'A próxima aventura começa com a mesa reunida.',
  inviteCode: generateInviteCode(),
};
db.insert(campaigns).values(campaign).run();

db.insert(campaignMembers)
  .values({ id: randomUUID(), campaignId: campaign.id, userId: master.id, role: 'master' })
  .run();
for (const player of players) {
  db.insert(campaignMembers)
    .values({ id: randomUUID(), campaignId: campaign.id, userId: player.id, role: 'player' })
    .run();
}

// A couple of sheets and a feed warm enough to review the phase-1 interface.
// The campaign is fresh on every run, so there is nothing to deduplicate.
const baseSheet: Omit<import('@quest-fast/shared').CharacterInput, 'name' | 'race' | 'class' | 'ownerId'> = {
  level: 3,
  abilityScores: { strength: 10, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 8, charisma: 13 },
  hp: 24,
  ac: 15,
  skills: ['acrobatics', 'stealth', 'perception'],
  saves: ['dexterity', 'intelligence'],
  attacks: [{ name: 'Adaga', bonus: 7, damage: '1d4+4' }],
  features: ['Ataque furtivo 2d6'],
  description: '',
  avatarAssetId: null,
  // Official D&D 2024 sheet fields.
  subclass: 'Ladra',
  background: 'Criminosa',
  alignment: 'Caótica e Boa',
  experience: 900,
  speed: 9,
  hitDie: 8,
  expertise: ['stealth'],
  armorTraining: ['light'],
  weaponProficiencies: 'Armas Simples e Marciais com Acuidade ou Leve',
  toolProficiencies: 'Ferramentas de ladrão',
  speciesTraits: ['Visão no Escuro', 'Ancestralidade Feérica'],
  feats: ['Alerta'],
  languages: 'Comum, Élfico e Gíria de Ladrão',
  equipment: 'Armadura de couro\nDuas adagas\nFerramentas de ladrão',
  coins: { cp: 0, sp: 15, ep: 0, gp: 40, pp: 0 },
};
const charactersSeed: Array<
  Omit<import('@quest-fast/shared').CharacterInput, 'name' | 'race' | 'class'> & {
    name: string;
    race: string;
    class: string;
    ownerId: string;
  }
> = [
  {
    ...baseSheet,
    name: 'Elara Sombravil',
    race: 'Meio-elfa',
    class: 'Ladina',
    ownerId: players[1].id,
    attacks: [
      { name: 'Adaga', bonus: 7, damage: '1d4+4', damageType: 'Perfurante' },
      { kind: 'save', name: 'Frasco de ácido', dc: 13, saveAbility: 'dexterity', damage: '2d6', damageType: 'Ácido', notes: 'Arremesso, 6 m' },
    ],
  },
  {
    ...baseSheet,
    name: 'Bram Linha Longa',
    race: 'Anão',
    class: 'Guerreiro',
    ownerId: master.id,
    level: 4,
    hp: 38,
    ac: 18,
    abilityScores: { strength: 17, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 12, charisma: 9 },
    skills: ['athletics', 'perception'],
    saves: ['strength', 'constitution'],
    attacks: [{ name: 'Machado de batalha', bonus: 6, damage: '1d10+3', damageType: 'Cortante', notes: 'Versátil (1d10)' }],
    subclass: 'Campeão',
    background: 'Soldado',
    alignment: 'Leal e Neutro',
    experience: 2700,
    shield: true,
    speed: 7.5,
    hitDie: 10,
    expertise: [],
    armorTraining: ['light', 'medium', 'heavy', 'shields'],
    weaponProficiencies: 'Armas Simples e Marciais',
    toolProficiencies: 'Ferramentas de ferreiro',
    speciesTraits: ['Visão no Escuro', 'Resiliência Anã'],
    feats: ['Atacante Selvagem'],
    languages: 'Comum e Anão',
    equipment: 'Cota de malha\nEscudo\nMachado de batalha',
    coins: { cp: 30, sp: 0, ep: 0, gp: 12, pp: 0 },
  },
];
const characterIds = new Map<string, string>();
for (const sheet of charactersSeed) {
  const id = randomUUID();
  characterIds.set(sheet.name, id);
  db.insert(characters)
    .values({
      id,
      campaignId: campaign.id,
      ownerId: sheet.ownerId,
      name: sheet.name,
      race: sheet.race,
      class: sheet.class,
      level: sheet.level,
      abilityScores: sheet.abilityScores,
      hp: sheet.hp,
      // A new sheet starts rested, as the API creates it. Each owner has one
      // sheet here, so each is the one they bring to the table.
      hpCurrent: sheet.hp,
      active: true,
      ac: sheet.ac,
      skills: sheet.skills,
      saves: sheet.saves,
      // Stored as the API stores them: every field filled.
      attacks: sheet.attacks.map((attack): Attack => {
        const details = { name: attack.name, damage: attack.damage, damageType: attack.damageType ?? '', notes: attack.notes ?? '' };
        return attack.kind === 'save'
          ? { ...details, kind: 'save', dc: attack.dc, saveAbility: attack.saveAbility! }
          : { ...details, kind: 'attack', bonus: attack.bonus };
      }),
      features: sheet.features,
      description: sheet.description,
      avatarAssetId: sheet.avatarAssetId,
      subclass: sheet.subclass ?? '',
      background: sheet.background ?? '',
      alignment: sheet.alignment ?? '',
      experience: sheet.experience ?? 0,
      shield: sheet.shield ?? false,
      speed: sheet.speed ?? 9,
      hitDie: sheet.hitDie ?? 8,
      expertise: sheet.expertise ?? [],
      armorTraining: sheet.armorTraining ?? [],
      weaponProficiencies: sheet.weaponProficiencies ?? '',
      toolProficiencies: sheet.toolProficiencies ?? '',
      speciesTraits: sheet.speciesTraits ?? [],
      feats: sheet.feats ?? [],
      languages: sheet.languages ?? '',
      equipment: sheet.equipment ?? '',
      coins: sheet.coins ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    })
    .run();
}

// The bestiary and an encounter ready to start: the master opens it, rolls
// the monsters' initiative and runs the fight, as `verify:group` does.
type SeedStatblock = {
  name: string;
  size: 'small' | 'medium';
  creatureType: string;
  challengeRating: string;
  ac: number;
  hpAverage: number;
  hpFormula: string;
  speed: string;
  abilityScores: AbilityScores;
  attacks: Attack[];
  traits?: string;
};
const bestiary: SeedStatblock[] = [
  {
    name: 'Goblin',
    size: 'small',
    creatureType: 'Feérico (goblinoide)',
    challengeRating: '1/4',
    ac: 15,
    hpAverage: 7,
    hpFormula: '2d6',
    speed: '9 m',
    abilityScores: { strength: 8, dexterity: 15, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
    attacks: [
      { kind: 'attack', name: 'Cimitarra', bonus: 4, damage: '1d6+2', damageType: 'Cortante', notes: '' },
      { kind: 'attack', name: 'Arco curto', bonus: 4, damage: '1d6+2', damageType: 'Perfurante', notes: 'Distância 24/96 m' },
    ],
    traits: 'Fuga ágil: Desengajar ou Esconder como ação bônus.',
  },
  {
    name: 'Lobo',
    size: 'medium',
    creatureType: 'Fera',
    challengeRating: '1/4',
    ac: 12,
    hpAverage: 11,
    hpFormula: '2d8+2',
    speed: '12 m',
    abilityScores: { strength: 14, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
    attacks: [{ kind: 'attack', name: 'Mordida', bonus: 4, damage: '1d6+2', damageType: 'Perfurante', notes: 'Alvo Grande ou menor: Caído' }],
    traits: 'Táticas de matilha: vantagem se um aliado estiver a 1,5 m do alvo.',
  },
  {
    name: 'Goblin xamã',
    size: 'small',
    creatureType: 'Feérico (goblinoide)',
    challengeRating: '1',
    ac: 12,
    hpAverage: 13,
    hpFormula: '3d6+3',
    speed: '9 m',
    abilityScores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 15, charisma: 12 },
    attacks: [
      { kind: 'attack', name: 'Bordão', bonus: 1, damage: '1d6-1', damageType: 'Concussão', notes: '' },
      { kind: 'save', name: 'Chama sagrada', dc: 12, saveAbility: 'dexterity', damage: '1d8', damageType: 'Radiante', notes: 'Alcance 18 m' },
    ],
  },
];
const statblockIds = new Map<string, string>();
for (const statblock of bestiary) {
  const id = randomUUID();
  statblockIds.set(statblock.name, id);
  db.insert(statblocks).values({ id, campaignId: campaign.id, ...statblock }).run();
}

const encounterId = randomUUID();
db.insert(encounters).values({ id: encounterId, campaignId: campaign.id, name: 'Emboscada na estrada' }).run();
for (const sheet of charactersSeed) {
  db.insert(combatants)
    .values({
      id: randomUUID(),
      encounterId,
      source: 'character',
      characterId: characterIds.get(sheet.name)!,
      name: sheet.name,
      size: 'medium',
      dexModifier: abilityModifier(sheet.abilityScores.dexterity) ?? 0,
    })
    .run();
}
// Copies as the server makes them: numbered, average hit points.
const bestiaryByName = new Map(bestiary.map((entry) => [entry.name, entry]));
for (const [creature, names] of [['Goblin', ['Goblin 1', 'Goblin 2']], ['Lobo', ['Lobo']]] as const) {
  const statblock = bestiaryByName.get(creature)!;
  for (const name of names) {
    db.insert(combatants)
      .values({
        id: randomUUID(),
        encounterId,
        source: 'statblock',
        statblockId: statblockIds.get(creature)!,
        name,
        size: statblock.size,
        ac: statblock.ac,
        hpMax: statblock.hpAverage,
        hpCurrent: statblock.hpAverage,
        hpTemp: 0,
        conditions: [],
        concentrating: false,
        dexModifier: abilityModifier(statblock.abilityScores.dexterity) ?? 0,
        constitutionModifier: abilityModifier(statblock.abilityScores.constitution) ?? 0,
        attacks: statblock.attacks,
      })
      .run();
  }
}

// The feed with a visible history: a public roll and a secret one (the seed
// opens the interface as master, who may see it).
db.insert(sessionEvents)
  .values({
    id: randomUUID(),
    campaignId: campaign.id,
    userId: master.id,
    type: 'roll',
    secret: false,
    payload: {
      kind: 'roll',
      expression: '1d20+5',
      dice: [{ value: 14, sides: 20 }],
      modifier: 5,
      total: 19,
      mode: 'normal',
    },
  })
  .run();
db.insert(sessionEvents)
  .values({
    id: randomUUID(),
    campaignId: campaign.id,
    userId: players[1].id,
    type: 'roll',
    secret: false,
    payload: {
      kind: 'roll',
      expression: '2d6+3',
      dice: [
        { value: 5, sides: 6 },
        { value: 2, sides: 6 },
      ],
      modifier: 3,
      total: 10,
      mode: 'normal',
    },
  })
  .run();

const session = randomUUID();
db.insert(sessions)
  .values({
    id: session,
    userId: master.id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  .run();

console.log(`Campaign "${campaign.name}" created with invite code ${campaign.inviteCode}.`);
console.log(`Encounter "Emboscada na estrada" ready to start, with ${bestiary.length} creatures in the bestiary.`);
console.log(`Master session (qf_session cookie): ${session}`);
