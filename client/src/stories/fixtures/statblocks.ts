import type { Statblock, StatblockSummary } from '@quest-fast/shared';

const stamps = { campaignId: 'phandalin', createdAt: '2026-10-22T18:00:00.000Z', updatedAt: '2026-10-22T18:00:00.000Z' };

/** A small, common creature: the bestiary's everyday case. */
export const goblin: Statblock = {
  ...stamps,
  id: 'goblin',
  name: 'Goblin',
  size: 'small',
  creatureType: 'Humanoide (goblinoide)',
  challengeRating: '1/4',
  ac: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  speed: '9 m',
  initiativeBonus: 0,
  abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
  attacks: [
    { name: 'Cimitarra', bonus: 4, damage: '1d6+2', damageType: 'Cortante', notes: 'Alcance 1,5 m' },
    { name: 'Arco curto', bonus: 4, damage: '1d6+2', damageType: 'Perfurante', notes: 'Distância 24/96 m' },
  ],
  traits: 'Fuga Ágil. Pode Desengajar ou Esconder como ação bônus.',
  actions: '',
  reactions: '',
};

/** Everything filled in, with several paragraphs per section. */
export const wyrmDasCinzas: Statblock = {
  ...stamps,
  id: 'wyrm',
  name: 'Wyrm das Cinzas',
  size: 'huge',
  creatureType: 'Dragão (cromático)',
  challengeRating: '17',
  ac: 19,
  hpAverage: 256,
  hpFormula: '19d12+133',
  speed: '12 m, escalada 12 m, voo 24 m',
  initiativeBonus: 4,
  abilityScores: { strength: 27, dexterity: 10, constitution: 25, intelligence: 16, wisdom: 13, charisma: 21 },
  attacks: [
    { name: 'Mordida', bonus: 14, damage: '2d10+8', damageType: 'Perfurante', notes: 'Mais 2d6 de fogo' },
    { name: 'Garra', bonus: 14, damage: '2d6+8', damageType: 'Cortante', notes: '' },
    { name: 'Cauda', bonus: 14, damage: '2d8+8', damageType: 'Concussão', notes: 'Alcance 4,5 m' },
  ],
  traits:
    'Resistência Lendária (3/dia). Se falhar numa salvaguarda, pode escolher passar.\n' +
    'Brasa Viva. Criaturas que terminam o turno a até 3 m do wyrm sofrem 2d6 de fogo.',
  actions:
    'Multiataque. Uma mordida e duas garras.\n' +
    'Sopro de Cinzas (recarga 5–6). Cone de 18 m; salvaguarda de Destreza CD 21, 18d6 de fogo, metade se passar.',
  reactions: 'Asa Defensiva. +3 na CA contra um ataque que o veria acertar.',
};

/** Long names and long text, to check wrapping in narrow columns. */
export const textosLongos: Statblock = {
  ...goblin,
  id: 'longo',
  name: 'Guardião Esquecido das Catacumbas Submersas de Vel’Tharon',
  creatureType: 'Constructo (guardião ancestral, ligado ao juramento da cidade afogada)',
  traits: 'Vigília Eterna. '.repeat(40).trim(),
};

/** The minimum the form accepts: no formula, no rating, no attacks, no text. */
export const semExtras: Statblock = {
  ...stamps,
  id: 'lobo',
  name: 'Lobo',
  size: 'medium',
  creatureType: '',
  challengeRating: '',
  ac: 13,
  hpAverage: 11,
  hpFormula: '',
  speed: '',
  initiativeBonus: 0,
  abilityScores: { strength: 12, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
  attacks: [],
  traits: '',
  actions: '',
  reactions: '',
};

export function summaryOf({ id, name, size, creatureType, challengeRating, ac, hpAverage }: Statblock): StatblockSummary {
  return { id, name, size, creatureType, challengeRating, ac, hpAverage };
}

export const bestiary: StatblockSummary[] = [goblin, semExtras, wyrmDasCinzas, textosLongos].map(summaryOf);
