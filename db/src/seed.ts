import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { generateInviteCode } from '@quest-fast/shared';
import { campaignMembers, campaigns, characters, createDb, sessionEvents, sessions, users } from './index.ts';

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
for (const sheet of charactersSeed) {
  db.insert(characters)
    .values({
      id: randomUUID(),
      campaignId: campaign.id,
      ownerId: sheet.ownerId,
      name: sheet.name,
      race: sheet.race,
      class: sheet.class,
      level: sheet.level,
      abilityScores: sheet.abilityScores,
      hp: sheet.hp,
      // A new sheet starts rested, as the API creates it.
      hpCurrent: sheet.hp,
      ac: sheet.ac,
      skills: sheet.skills,
      saves: sheet.saves,
      attacks: sheet.attacks.map((attack) => ({ damageType: '', notes: '', ...attack })),
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
console.log(`Master session (qf_session cookie): ${session}`);
