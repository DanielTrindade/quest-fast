import {
  CHARACTER_LIMITS as L,
  COMBAT_LIMITS,
  CONDITIONS,
  ENCOUNTER_LIMITS,
  STATBLOCK_LIMITS as S,
  type CampaignMember,
  type InvitePreview,
  type InviteViewer,
  type CampaignSummary,
  type CharacterSheet,
  type CharacterSummary,
  type CombatantView,
  type EncounterView,
  type PublicUser,
  type Role,
  type SessionEvent,
  type Spell,
  type Statblock,
  type StatblockSummary,
} from '@quest-fast/shared';
import { hazinDan, lyraVentoclaro } from './characters';
import { masterCombatants } from './encounters';
import { goblin, semExtras, wyrmDasCinzas } from './statblocks';

export const DATA_STATES = ['demo', 'worst', 'empty', 'one', 'huge'] as const;
export type DataState = (typeof DATA_STATES)[number];
export const DATA_LABELS: Record<DataState, string> = {
  demo: 'Demo',
  worst: 'Pior caso',
  empty: 'Vazio',
  one: 'Um',
  huge: 'Muitos',
};

export const CAMPAIGN_ID = 'c1';

type Dataset = {
  me: PublicUser;
  campaigns: CampaignSummary[];
  inviteCode: string;
  members: CampaignMember[];
  characters: CharacterSheet[];
  statblocks: Statblock[];
  encounters: EncounterView[];
  feed: SessionEvent[];
  feedCursor: string | null;
};

// Values at the schema limit stay realistic text, cut at the limit like the form would.
function fit(text: string, limit: number) {
  return text.length <= limit ? text : text.slice(0, limit).trimEnd();
}

const now = Date.parse('2026-11-10T22:47:00.000Z');
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

function member(id: string, name: string, role: Role, minutesAgo: number, avatarUrl: string | null = null): CampaignMember {
  return { id: `m-${id}`, userId: id, name, avatarUrl, role, joinedAt: ago(minutesAgo) };
}

const stamps = { campaignId: CAMPAIGN_ID, createdAt: ago(9000), updatedAt: ago(9000) };

function encounter(id: string, name: string, status: EncounterView['status'], round: number, combatants: CombatantView[], extra: Partial<EncounterView> = {}): EncounterView {
  const first = combatants.find((combatant) => combatant.hasInitiative && !combatant.defeated);
  return {
    id, campaignId: CAMPAIGN_ID, name, status, round,
    activeCombatantId: status === 'active' && round > 0 ? first?.id ?? null : null,
    activeHidden: false, version: 1, createdAt: ago(600), startedAt: status === 'preparing' ? null : ago(500),
    endedAt: status === 'ended' ? ago(400) : null, combatants,
    summary: status === 'ended' ? { rounds: round, defeated: combatants.filter((item) => item.defeated).map((item) => item.name) } : null,
    ...extra,
  };
}

function roll(id: string, user: PublicUser, minutesAgo: number, payload: Partial<Extract<SessionEvent, { type: 'roll' }>['payload']>, secret = false): SessionEvent {
  const dice = payload.dice ?? [{ sides: 20, value: 11 }];
  const modifier = payload.modifier ?? 0;
  const total = payload.total ?? dice.filter((die) => !die.discarded).reduce((sum, die) => sum + die.value, modifier);
  return {
    id, campaignId: CAMPAIGN_ID, userId: user.id, userName: user.name, type: 'roll', secret, createdAt: ago(minutesAgo),
    payload: { kind: 'roll', expression: '1d20', mode: 'normal', ...payload, dice, modifier, total },
  };
}

// --- Demo: the kind data the screens were designed against ------------------

const lia: PublicUser = { id: 'lia', name: 'Lia Martins', avatarUrl: null };
const daniel: PublicUser = { id: 'daniel', name: 'Daniel', avatarUrl: null };

const demo: Dataset = {
  me: lia,
  campaigns: [
    { id: CAMPAIGN_ID, name: 'Ecos de Phandalin', description: 'A mina perdida, quinzenal aos sábados.', role: 'master', joinedAt: ago(90000) },
    { id: 'c2', name: 'A névoa de Baróvia', description: '', role: 'player', joinedAt: ago(40000) },
  ],
  inviteCode: 'MESA42',
  members: [
    member('lia', 'Lia Martins', 'master', 90000),
    member('daniel', 'Daniel', 'player', 89000),
    member('ana', 'Ana Beatriz', 'player', 88000),
  ],
  characters: [hazinDan, lyraVentoclaro],
  statblocks: [goblin, wyrmDasCinzas, semExtras],
  encounters: [encounter('e1', 'Emboscada na estrada', 'active', 3, masterCombatants)],
  feed: [
    roll('f1', daniel, 30, { rollKind: 'attack', characterId: 'hazin', characterName: 'Hazin Dan', attackName: 'Machadinha', expression: '1d20+7', dice: [{ sides: 20, value: 14 }], modifier: 7 }),
    roll('f2', lia, 20, { expression: '2d6+3', dice: [{ sides: 6, value: 4 }, { sides: 6, value: 2 }], modifier: 3 }),
  ],
  feedCursor: null,
};

// --- Worst case: real people, real limits ----------------------------------

const aleksandra: PublicUser = {
  id: 'aleks',
  // Discord caps display names at 32 characters; this one is 31.
  name: 'Aleksandra Wiśniewska-Kowalczyk',
  avatarUrl: '/avatars/removido-do-discord.png',
};
// Without a global name the server falls back to the username: 32 characters, no spaces.
const bartholomew: PublicUser = { id: 'bart', name: 'bartholomew.fitzgerald.northwind', avatarUrl: null };
const jo: PublicUser = { id: 'jo', name: 'Jo', avatarUrl: null };
const thao: PublicUser = { id: 'thao', name: 'Nguyễn Thị Phương Thảo', avatarUrl: null };
const tallPortrait = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='60' height='240'><rect width='60' height='240' opacity='.35'/><circle cx='30' cy='40' r='24'/></svg>")}`;

const driveLink = 'https://drive.google.com/drive/folders/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF?usp=sharing';

const thalindra: CharacterSheet = {
  ...lyraVentoclaro,
  id: 'thalindra',
  ownerId: aleksandra.id,
  ownerName: aleksandra.name,
  name: fit('Thalindra Elarwen Silverleaf, Guardiã do Bosque Sagrado de Myth Drannor e das Fontes', L.name),
  race: fit('Meio-elfa (linhagem aquática dos Mares de Ruathym, variante)', L.shortText),
  class: 'Bruxa',
  subclass: fit('Patrono Celestial da Corte das Estrelas Cadentes de Selûne', L.shortText),
  background: fit('Eremita do Mosteiro Esquecido nas Montanhas da Espinha do Mundo', L.shortText),
  alignment: 'Caótica e Boa',
  level: L.level.max,
  experience: L.experience.max,
  hp: L.hp.max,
  hpCurrent: L.hp.max,
  hpTemp: L.hpTemp.max,
  ac: L.ac.max,
  speed: L.speed.max,
  hitDie: 8,
  hitDiceSpent: 19,
  abilityScores: { strength: 1, dexterity: 30, constitution: 30, intelligence: 30, wisdom: 30, charisma: 30 },
  initiativeBonus: L.adjustment.max,
  passivePerceptionBonus: L.adjustment.min,
  skills: ['arcana', 'history', 'insight', 'investigation', 'perception', 'persuasion', 'deception', 'intimidation', 'animalHandling', 'sleightOfHand'],
  expertise: ['arcana', 'perception', 'persuasion', 'deception'],
  saves: ['wisdom', 'charisma', 'dexterity', 'constitution', 'intelligence', 'strength'],
  weaponProficiencies: fit('Armas simples, bestas de mão, espadas longas, rapieiras, espadas curtas, chicotes, cimitarras, lanças de montaria, armas de fogo renascentistas e armas improvisadas de qualquer tipo', L.proficiencyText),
  toolProficiencies: fit('Kit de herbalismo, kit de disfarce, ferramentas de ladrão, instrumentos de caligrafia, alaúde, flauta de Pã, ferramentas de cartógrafo, suprimentos de alquimista e jogo de dragonchess', L.proficiencyText),
  attacks: Array.from({ length: L.attacks }, (_, index) => index % 2 === 0
    ? { kind: 'attack' as const, name: fit(`Lâmina Sagrada da Estrela Cadente de Selûne, forjada no Plano Astral (${index + 1})`, L.name), bonus: L.attackBonus, damage: fit('2d10+8d6+4d8+1d4+12', L.damage), damageType: fit('Radiante e necrótico (metade cada)', L.damageType), notes: fit('Acuidade, leve, versátil (1d10). Ignora resistência a dano radiante. Recarga 5–6 após um descanso curto ou longo. Ver https://dndbeyond.com/x', L.attackNotes) }
    : { kind: 'save' as const, name: fit(`Explosão Eldritch com Invocação Repelente ${index + 1}`, L.name), dc: L.saveDc.max, saveAbility: 'constitution' as const, damage: '10d10+100', damageType: 'Energia', notes: '' }),
  features: Array.from({ length: L.listItems }, (_, index) => fit(`Característica ${index + 1}: uma vez por descanso longo, quando uma criatura que você possa ver a até 18 m falhar numa salvaguarda contra uma magia sua, você pode gastar uma ação bônus para impor desvantagem no próximo teste de resistência que ela fizer antes do fim do seu próximo turno, com regras completas.`, L.listItem)),
  speciesTraits: ['Visão no Escuro', 'Ancestralidade Feérica', 'Anfíbia', 'Fala com Bestas do Mar', 'Transe'],
  feats: ['Iniciado em Magia', 'Conjurador de Guerra', 'Sortudo', 'Resiliente (Constituição)', 'Telepático', 'Tocado pelas Fadas'],
  spellcastingAbility: 'charisma',
  spellBonus: L.adjustment.max,
  spellSlots: [
    { total: 4, spent: 4 }, { total: 3, spent: 0 }, { total: 3, spent: 1 }, { total: 3, spent: 3 }, { total: 3, spent: 0 },
    { total: 2, spent: 2 }, { total: 2, spent: 0 }, { total: 1, spent: 1 }, { total: 1, spent: 0 },
  ],
  spells: Array.from({ length: L.spells }, (_, index): Spell => ({
    level: index % 10,
    name: index === 0 ? fit('Rajada Eldritch Aprimorada com Invocação Agonizante e Lança Eldritch de Longo Alcance', L.spellName) : `Magia ${index + 1} do Grimório`,
    castingTime: fit('1 reação, quando você vê uma criatura a até 18 m conjurar', L.spellShortText),
    range: fit('Pessoal (esfera de 9 m de raio)', L.spellShortText),
    concentration: index % 2 === 0, ritual: index % 3 === 0, material: index % 4 === 0,
    notes: fit(`Componente material: um diamante no valor de 300 PO, consumido pela magia. Detalhes: ${driveLink}`, L.spellNotes),
  })),
  appearance: fit(`Alta e esguia, pele azul-acinzentada com escamas iridescentes no pescoço. ${'Cabelos prateados presos em tranças com conchas e anéis de coral; olhos completamente negros que refletem estrelas. '.repeat(10)}`, L.appearance),
  description: fit(`Nasceu numa cidade submersa e foi levada à superfície ainda criança. Referência visual: ${driveLink} ${'Carrega um diário selado com runas que ninguém mais consegue ler, e consulta as estrelas antes de cada decisão importante do grupo. '.repeat(16)}`, L.description),
  languages: fit('Comum, Élfico, Aquan, Silvestre, Celestial, Dracônico, Abissal, Infernal, Primordial, Gnômico, Gigante, Língua de Sinais dos Ladrões, Druídico, Subcomum, Anão', L.languages),
  equipment: fit(`${driveLink}\n${Array.from({ length: 60 }, (_, index) => `${index + 1}x Item do inventário com descrição longa`).join('\n')}`, L.equipment),
  attunedItems: [
    fit('Cajado do Poder Arcano de Mordenkainen, o Grande Mago de Greyhawk e Oerth', L.attunedItem),
    fit('Anel de Proteção contra Energia Negativa +3', L.attunedItem),
    fit('Manto das Estrelas Cadentes da Corte de Selûne', L.attunedItem),
  ],
  coins: { cp: L.coins, sp: L.coins, ep: L.coins, gp: L.coins, pp: L.coins },
  deathSaves: { successes: 2, failures: 2 },
  heroicInspiration: true,
  conditions: CONDITIONS.map((condition) => condition === 'exhaustion' ? { condition, level: 6 } : { condition, roundsLeft: COMBAT_LIMITS.conditionRounds.max }),
  concentrating: true,
  avatarUrl: tallPortrait,
};

const bo: CharacterSheet = {
  ...hazinDan,
  id: 'bo',
  ownerId: jo.id,
  ownerName: jo.name,
  name: 'Bo',
  race: 'Gnomo',
  class: 'Ladino',
  subclass: '',
  // eslint-disable-next-line local/no-raw-color -- "background" é o antecedente da ficha.
  background: '',
  alignment: '',
  level: 1,
  experience: 0,
  hp: 1,
  hpCurrent: 0,
  hpTemp: 0,
  ac: 0,
  speed: 0,
  skills: [],
  saves: [],
  armorTraining: [],
  weaponProficiencies: '',
  toolProficiencies: '',
  attacks: [],
  features: [],
  speciesTraits: [],
  feats: [],
  languages: '',
  equipment: '',
  coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  deathSaves: { successes: 0, failures: 3 },
  heroicInspiration: false,
  avatarUrl: null,
};

const worstCharacters: CharacterSheet[] = [
  thalindra,
  bo,
  { ...hazinDan, id: 'thao-pc', ownerId: thao.id, ownerName: thao.name, name: 'Nguyễn Thị Phương Thảo', race: 'Tiefling', class: 'Feiticeira', avatarUrl: '/avatars/removido-do-discord.png' },
  { ...hazinDan, id: 'reginald', ownerId: bartholomew.id, ownerName: bartholomew.name, name: 'Sir Reginald Ashworth-Pemberton III', hpCurrent: 7, hpTemp: 0 },
  { ...hazinDan, id: 'drako', ownerId: 'bruno', ownerName: '🇧🇷 Bruno', name: '🐉 Drako Fumegante', race: 'Draconato' },
  { ...hazinDan, id: 'zahra', ownerId: 'mohammed', ownerName: 'محمد العلي', name: 'زهرة الصحراء', race: 'Humana', class: 'Paladina' },
];

const guardian = fit('Guardião Esquecido das Catacumbas Submersas de Vel’Tharon, Senhor das Marés', S.name);

const worstStatblocks: Statblock[] = [
  {
    ...stamps,
    id: 'guardian',
    name: guardian,
    size: 'gargantuan',
    creatureType: fit('Constructo (guardião ancestral ligado ao juramento da cidade)', S.creatureType),
    challengeRating: '30',
    ac: S.ac.max,
    hpAverage: S.hp.max,
    hpFormula: fit('20d20+20d12+20d10+20d8+20d6', S.hpFormula),
    speed: fit('9 m, escalada 9 m, natação 24 m, voo 36 m (pairar), escavar 3 m', S.speed),
    initiativeBonus: S.initiativeBonus.max,
    abilityScores: { strength: 30, dexterity: 1, constitution: 30, intelligence: 1, wisdom: 30, charisma: 30 },
    attacks: Array.from({ length: S.attacks }, (_, index) => ({
      kind: 'attack' as const, name: fit(`Pancada Abissal das Profundezas Esquecidas ${index + 1}`, L.name), bonus: L.attackBonus,
      damage: '10d12+10d10+100', damageType: 'Concussão', notes: fit(`Alcance 9 m. O alvo fica agarrado (CD 30 para escapar). ${driveLink}`, L.attackNotes),
    })),
    traits: fit(`Vigília Eterna. Referência: ${driveLink}\n${'Resistência Lendária (5/dia). Se falhar numa salvaguarda, pode escolher passar. '.repeat(60)}`, S.text),
    actions: fit('Multiataque. Quatro pancadas. '.repeat(160), S.text),
    reactions: fit('Muralha de Água. +5 na CA contra um ataque que o veria acertar. '.repeat(70), S.text),
  },
  { ...goblin, id: 'tiny', name: 'Rato', size: 'tiny', creatureType: 'Fera', challengeRating: '0', ac: 1, hpAverage: 1, hpFormula: '1d4-1', initiativeBonus: S.initiativeBonus.min },
  semExtras,
  { ...wyrmDasCinzas, id: 'cr18', challengeRating: '1/8', name: 'Kobold Alado' },
];

function combatant(id: string, name: string, extra: Partial<CombatantView> = {}): CombatantView {
  return {
    id, source: 'statblock', characterId: null, ownerId: null, name, size: 'medium', hidden: false,
    initiative: 10, hasInitiative: true, dexModifier: 0, tieOrder: 0, ac: 15, hpMax: 30, hpCurrent: 30, hpTemp: 0,
    healthBand: 'unhurt', defeated: false, conditions: [], concentrating: false, deathSaves: null, deathSaveRolled: false, reminders: [], attacks: [], ...extra,
  };
}

const worstCombatants: CombatantView[] = [
  combatant('w-fast', `${guardian} 12`, {
    initiative: ENCOUNTER_LIMITS.initiative.max, ac: S.ac.max, hpMax: S.hp.max, hpCurrent: S.hp.max, hpTemp: L.hpTemp.max, size: 'gargantuan',
    conditions: CONDITIONS.map((condition) => condition === 'exhaustion' ? { condition, level: 6 } : { condition, roundsLeft: COMBAT_LIMITS.conditionRounds.max }),
    concentrating: true, reminders: [{ id: 'r1', kind: 'concentration', dc: 30 }],
  }),
  combatant('w-thal', thalindra.name, {
    source: 'character', characterId: thalindra.id, ownerId: aleksandra.id, initiative: 23, ac: 40, hpMax: 999, hpCurrent: 999, hpTemp: 999,
    deathSaves: { successes: 2, failures: 2 }, concentrating: true, conditions: [{ condition: 'exhaustion', level: 6 }],
  }),
  combatant('w-bo', 'Bo', {
    source: 'character', characterId: bo.id, ownerId: jo.id, initiative: 1, ac: 0, hpMax: 1, hpCurrent: 0, healthBand: 'defeated',
    deathSaves: { successes: 0, failures: 2 }, reminders: [{ id: 'r2', kind: 'deathFailure' }], conditions: [{ condition: 'unconscious' }],
  }),
  combatant('w-hidden', 'Bandido escondido atrás da carroça tombada', { source: 'manual', hidden: true, initiative: 12 }),
  combatant('w-def', 'Rato 1', { initiative: 0, hpCurrent: 0, hpMax: 1, healthBand: 'defeated', defeated: true }),
  combatant('w-slow', 'Kobold Alado 1', { initiative: ENCOUNTER_LIMITS.initiative.min, hpCurrent: 3, hpMax: 30, healthBand: 'bloodied', conditions: [{ condition: 'prone', roundsLeft: 1 }] }),
  combatant('w-none', 'Zumbi sem iniciativa', { initiative: null, hasInitiative: false }),
];

const worst: Dataset = {
  me: aleksandra,
  campaigns: [
    {
      id: CAMPAIGN_ID,
      name: fit('Ecos de Phandalin: a Mina Perdida de Phandelver e os Segredos da Ordem do Manto', 80),
      description: fit(`Sessões quinzenais aos sábados, das 19h às 23h. Mapas, handouts e a ficha da casa: ${driveLink} — leiam antes da próxima sessão, por favor! ${'Regras da casa: crítico máximo no dano, poções como ação bônus, inspiração heroica por boa interpretação. '.repeat(4)}`, 500),
      role: 'master',
      joinedAt: ago(500000),
    },
    { id: 'c2', name: 'X', description: '', role: 'player', joinedAt: ago(60) },
    { id: 'c3', name: 'de e da', description: 'Uma campanha de teste com nome só de conectivos.', role: 'player', joinedAt: ago(30000) },
    { id: 'c4', name: '🐉 Dragões de Krynn', description: 'Sem descrição útil, só emoji 🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉', role: 'master', joinedAt: ago(20000) },
  ],
  inviteCode: 'Q7XK2M',
  members: [
    member(aleksandra.id, aleksandra.name, 'master', 500000, aleksandra.avatarUrl),
    member(jo.id, jo.name, 'player', 400000),
    member(bartholomew.id, bartholomew.name, 'player', 300000),
    member(thao.id, thao.name, 'player', 200000, '/avatars/removido-do-discord.png'),
    member('bruno', '🇧🇷 Bruno', 'player', 100000),
    member('ana', '👩‍🚀 Ana Clara', 'player', 50000),
    member('mohammed', 'محمد العلي', 'player', 40000),
    member('pedro', 'Pedro Montgomery III', 'player', 30000),
    member('noname', 'Aventureiro sem nome', 'player', 20000),
  ],
  characters: worstCharacters,
  statblocks: worstStatblocks,
  encounters: [
    encounter('e1', fit('Emboscada na Ponte sobre o Rio Triboar, onde os bandidos cobravam pedágio dos viajantes', ENCOUNTER_LIMITS.name), 'active', 12, worstCombatants),
    encounter('e2', 'Covil', 'preparing', 0, worstCombatants.map((item) => ({ ...item, initiative: null, hasInitiative: false }))),
    encounter('e3', 'Rato', 'ended', 1, [worstCombatants[4]]),
  ],
  feed: [
    roll('w1', bartholomew, 60 * 24 * 21, { expression: '1d20', dice: [{ sides: 20, value: 1 }, { sides: 20, value: 20, discarded: true }], mode: 'disadvantage', natural: 1 }),
    {
      id: 'w2', campaignId: CAMPAIGN_ID, userId: aleksandra.id, userName: aleksandra.name, type: 'combat.ended', secret: false, createdAt: ago(60 * 26),
      payload: {
        kind: 'combat.ended', encounterId: 'e0', encounterName: fit('Emboscada na Ponte sobre o Rio Triboar, onde os bandidos cobravam pedágio dos viajantes', 80), rounds: 1,
        defeated: Array.from({ length: 24 }, (_, index) => ({ name: index === 0 ? `${guardian} ${index + 1}` : `Goblin ${index + 1}`, hidden: index === 5 })),
      },
    },
    roll('w3', aleksandra, 30, {
      expression: '20d20+20d12+20d10+20d8+20d6+100',
      dice: [20, 12, 10, 8, 6].flatMap((sides) => Array.from({ length: 20 }, (_, index) => ({ sides, value: (index % sides) + 1 }))),
      modifier: 100,
    }, true),
    roll('w4', aleksandra, 20, { rollKind: 'attack', characterId: thalindra.id, characterName: thalindra.name, attackName: thalindra.attacks[0].name, expression: '1d20+20', dice: [{ sides: 20, value: 20 }, { sides: 20, value: 3, discarded: true }], mode: 'advantage', modifier: 20, natural: 20 }),
    roll('w5', jo, 10, { rollKind: 'skill', characterId: bo.id, characterName: 'Bo', skill: 'animalHandling', expression: '1d20-10', dice: [{ sides: 20, value: 2 }], modifier: -10 }),
    { id: 'w6', campaignId: CAMPAIGN_ID, userId: thao.id, userName: thao.name, type: 'token.moved', secret: false, createdAt: ago(5), payload: { tokenId: 't1' } } as SessionEvent,
    roll('w7', { id: 'mohammed', name: 'محمد العلي', avatarUrl: null }, 1, { expression: '1d100', dice: [{ sides: 100, value: 100 }] }),
  ],
  feedCursor: null,
};

// --- Empty, one, many ---------------------------------------------------------

const empty: Dataset = {
  me: lia,
  campaigns: [{ id: CAMPAIGN_ID, name: 'Ecos de Phandalin', description: '', role: 'master', joinedAt: ago(10) }],
  inviteCode: 'MESA42',
  members: [member('lia', 'Lia Martins', 'master', 10)],
  characters: [],
  statblocks: [],
  encounters: [],
  feed: [],
  feedCursor: null,
};

const one: Dataset = {
  me: lia,
  campaigns: [demo.campaigns[0]],
  inviteCode: 'MESA42',
  members: [demo.members[0], demo.members[1]],
  characters: [hazinDan],
  statblocks: [goblin],
  encounters: [encounter('e1', 'Emboscada na estrada', 'ended', 1, [combatant('o1', 'Goblin 1', { initiative: 12, hpCurrent: 0, healthBand: 'defeated', defeated: true })])],
  feed: [demo.feed[0]],
  feedCursor: null,
};

const crowd = Array.from({ length: 40 }, (_, index) => member(`p${index}`, `Jogador ${index + 1} da Mesa Aberta`, index === 0 ? 'master' : 'player', 1000 - index));

const huge: Dataset = {
  me: { ...lia, id: 'p0' },
  campaigns: Array.from({ length: 40 }, (_, index) => ({
    id: index === 0 ? CAMPAIGN_ID : `h${index}`, name: `Campanha ${index + 1}: ${index % 2 ? 'Ecos de Phandalin' : 'A névoa de Baróvia'}`,
    description: index % 3 ? 'Quinzenal aos sábados.' : '', role: index % 4 ? 'player' : 'master', joinedAt: ago(index * 1000),
  })),
  inviteCode: 'MESA42',
  members: crowd,
  characters: Array.from({ length: 39 }, (_, index) => ({ ...hazinDan, id: `hc${index}`, ownerId: `p${index + 1}`, ownerName: crowd[index + 1].name, name: `Aventureiro ${index + 1}` })),
  statblocks: Array.from({ length: 200 }, (_, index) => ({ ...goblin, id: `hs${index}`, name: `Criatura ${index + 1}` })),
  encounters: [
    encounter('e1', 'Batalha campal', 'active', 7, Array.from({ length: ENCOUNTER_LIMITS.combatants }, (_, index) =>
      combatant(`hb${index}`, `Goblin ${index + 1}`, { initiative: 30 - (index % 30), tieOrder: Math.floor(index / 30) }))),
    ...Array.from({ length: 49 }, (_, index) => encounter(`he${index}`, `Encontro ${index + 1}`, 'ended', index + 1, [])),
  ],
  feed: Array.from({ length: 50 }, (_, index) => roll(`hf${index}`, lia, 50 - index, { expression: '1d20+5', dice: [{ sides: 20, value: (index % 20) + 1 }], modifier: 5 })),
  feedCursor: 'older',
};

const DATASETS: Record<DataState, Dataset> = { demo, worst, empty, one, huge };

function summary(sheet: CharacterSheet): CharacterSummary {
  const { id, name, race, class: className, level, ownerId, ownerName, avatarUrl, hp, hpCurrent, hpTemp, ac, active } = sheet;
  return { id, name, race, class: className, level, ownerId, ownerName, avatarUrl, hp, hpCurrent, hpTemp, ac, active };
}

function statblockSummary({ id, name, size, creatureType, challengeRating, ac, hpAverage, hpFormula }: Statblock): StatblockSummary {
  return { id, name, size, creatureType, challengeRating, ac, hpAverage, hpFormula };
}

/** What the server projects for a player: no hidden combatant, monsters by band only. */
function forPlayer(view: EncounterView): EncounterView {
  return {
    ...view,
    combatants: view.combatants.filter((item) => !item.hidden).map((item) => item.source === 'character'
      ? { ...item, dexModifier: null, tieOrder: null }
      : { ...item, initiative: null, ac: null, hpMax: null, hpCurrent: null, hpTemp: null, dexModifier: null, tieOrder: null, concentrating: false, reminders: [], attacks: [] }),
  };
}

export type InviteScenario = InviteViewer | 'broken';

type Reply = { status: number; body?: unknown };

const INVITE_CODE = 'MESA42';

function inviteReply(data: Dataset, scenario: InviteScenario, code: string): Reply {
  if (code !== INVITE_CODE) return { status: 404, body: { error: 'Convite inválido.' } };
  if (scenario === 'broken') return { status: 500, body: { error: 'Erro interno.' } };
  const campaign = data.campaigns.find((item) => item.id === CAMPAIGN_ID);
  const master = data.members.find((item) => item.role === 'master');
  const preview: InvitePreview = {
    code: INVITE_CODE,
    campaignName: campaign?.name ?? 'Mesa',
    master: { name: master?.name ?? 'Mestre', avatarUrl: null },
    playerCount: data.members.filter((item) => item.role === 'player').length,
    viewer: scenario,
    ...(scenario === 'member' ? { campaignId: CAMPAIGN_ID } : {}),
  };
  return { status: 200, body: preview };
}

/**
 * Answers `/api/*` as the server would for this dataset and viewer, so the
 * real screens render the worst case through their own queries.
 */
export function respond(state: DataState, role: Role, method: string, path: string, invite?: InviteScenario): Reply {
  const data = DATASETS[state];
  const master = role === 'master';
  const me = master ? data.me : { id: data.members.find((item) => item.role === 'player')?.userId ?? 'player', name: data.members.find((item) => item.role === 'player')?.name ?? 'Jogador', avatarUrl: null };
  const notFound = { status: 404, body: { error: 'Não encontrado.' } };
  if (method === 'POST' && path === '/api/campaigns/join') {
    const campaign = data.campaigns.find((item) => item.id === CAMPAIGN_ID);
    return { status: 201, body: { id: CAMPAIGN_ID, name: campaign?.name ?? 'Mesa', role: 'player' } };
  }
  if (method !== 'GET') return { status: 422, body: { error: 'Ação desativada no laboratório de dados.' } };

  const base = `/api/campaigns/${CAMPAIGN_ID}`;
  const encounters = data.encounters.filter((item) => master || item.status !== 'preparing').map((item) => master ? item : forPlayer(item));
  const [pathname] = path.split('?');

  if (invite && pathname.startsWith('/api/invites/')) return inviteReply(data, invite, pathname.slice('/api/invites/'.length));
  if (pathname === '/api/auth/me') return { status: 200, body: { user: me } };
  // The gallery treats every sheet of the dataset as the viewer's, so the
  // extremes reach the account screen too.
  if (pathname === '/api/me/characters') {
    // Spread over the dataset's campaigns, one active per campaign and the
    // rest in reserve, as a player with a long history has them.
    const seen = new Set<string>();
    const characters = data.characters.map((item, index) => {
      const campaign = data.campaigns[index % Math.max(data.campaigns.length, 1)];
      const campaignId = campaign?.id ?? CAMPAIGN_ID;
      const active = !seen.has(campaignId);
      seen.add(campaignId);
      return { ...item, ownerId: me.id, ownerName: me.name, campaignId, campaignName: campaign?.name ?? 'Mesa', active };
    });
    return { status: 200, body: { characters } };
  }
  if (pathname === '/api/campaigns') return { status: 200, body: { campaigns: data.campaigns.map((item) => item.id === CAMPAIGN_ID ? { ...item, role } : item) } };
  if (pathname === base) {
    const campaign = data.campaigns.find((item) => item.id === CAMPAIGN_ID);
    if (!campaign) return notFound;
    return { status: 200, body: { id: campaign.id, name: campaign.name, description: campaign.description, role, ...(master ? { inviteCode: data.inviteCode } : {}) } };
  }
  if (pathname === `${base}/bans`) return master ? { status: 200, body: { bans: [] } } : notFound;
  if (pathname === `${base}/members`) return { status: 200, body: { members: data.members } };
  if (pathname === `${base}/characters`) return { status: 200, body: { characters: data.characters.map(summary) } };
  if (pathname.startsWith(`${base}/characters/`)) {
    const character = data.characters.find((item) => item.id === pathname.slice(`${base}/characters/`.length));
    return character ? { status: 200, body: { character } } : notFound;
  }
  if (pathname === `${base}/statblocks`) return master ? { status: 200, body: { statblocks: data.statblocks.map(statblockSummary) } } : notFound;
  if (pathname.startsWith(`${base}/statblocks/`)) {
    const statblock = data.statblocks.find((item) => item.id === pathname.slice(`${base}/statblocks/`.length));
    return master && statblock ? { status: 200, body: { statblock } } : notFound;
  }
  if (pathname === `${base}/encounters`) {
    return { status: 200, body: { encounters: encounters.map(({ id, name, status, round, createdAt, endedAt, combatants }) => ({ id, name, status, round, createdAt, endedAt, combatantCount: combatants.length })) } };
  }
  if (pathname.startsWith(`${base}/encounters/`)) {
    const encounter = encounters.find((item) => item.id === pathname.slice(`${base}/encounters/`.length));
    return encounter ? { status: 200, body: { encounter } } : notFound;
  }
  if (pathname === `${base}/feed`) {
    const events = data.feed.filter((event) => master || !event.secret);
    return { status: 200, body: { events, nextCursor: path.includes('cursor=') ? null : data.feedCursor } };
  }
  return notFound;
}
