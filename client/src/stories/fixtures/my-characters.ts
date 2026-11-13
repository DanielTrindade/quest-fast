import type { CharacterSummary, MyCharacter } from '@quest-fast/shared';
import { hazinDan, lyraVentoclaro } from './characters';

export const PORTRAIT = '/portraits/elara-example.png';

export const hazin: MyCharacter = { ...hazinDan, campaignName: 'Mesa de quinta' };

export const elara: MyCharacter = {
  ...lyraVentoclaro,
  id: 'elara',
  ownerId: 'daniel',
  ownerName: 'Daniel',
  name: 'Elara Sombravil',
  race: 'Elfa',
  class: 'Maga',
  subclass: 'Evocadora',
  // "background" é o antecedente da ficha, não uma cor.
  // eslint-disable-next-line local/no-raw-color
  background: 'Sábia',
  alignment: 'Neutra',
  level: 5,
  hp: 27,
  hpCurrent: 27,
  hpTemp: 0,
  ac: 13,
  abilityScores: { strength: 8, dexterity: 14, constitution: 14, intelligence: 18, wisdom: 12, charisma: 10 },
  avatarUrl: PORTRAIT,
  campaignId: 'veltharon',
  campaignName: 'Ruínas de Vel’Tharon',
};

export const tobias: MyCharacter = {
  ...hazin,
  id: 'tobias',
  name: 'Tobias Pé-de-Vento',
  race: 'Halfling',
  class: 'Ladino',
  subclass: 'Trapaceiro Arcano',
  // eslint-disable-next-line local/no-raw-color
  background: 'Charlatão',
  alignment: 'Caótico e Bom',
  level: 3,
  hp: 21,
  hpCurrent: 4,
  hpTemp: 0,
  ac: 14,
  speed: 7.5,
  abilityScores: { strength: 9, dexterity: 18, constitution: 13, intelligence: 14, wisdom: 12, charisma: 13 },
  active: false,
  campaignId: 'veltharon',
  campaignName: 'Ruínas de Vel’Tharon',
};

/** Limits the schema allows: an 80-character name without spaces, 30 in every score, no subclass. */
export const worstCase: MyCharacter = {
  ...hazin,
  id: 'worst',
  name: 'Wolfeschlegelsteinhausenbergerdorffwelchevoralternwarengewissenhaftschaferswesen',
  race: 'Meio-dragão de sangue cromático das montanhas do norte',
  class: 'Feiticeiro',
  subclass: '',
  // eslint-disable-next-line local/no-raw-color
  background: '',
  alignment: '',
  level: 20,
  hp: 999,
  hpCurrent: 0,
  hpTemp: 120,
  ac: 30,
  speed: 30,
  abilityScores: { strength: 30, dexterity: 30, constitution: 30, intelligence: 30, wisdom: 30, charisma: 30 },
  campaignName: 'Campanha🐉comumnomequenãoacabanuncaporquealguémesqueceudeusarespaços',
};

export const myCharacters: MyCharacter[] = [hazin, elara, tobias];

export function partyMember(sheet: MyCharacter): CharacterSummary {
  const { id, name, race, class: className, level, ownerId, ownerName, avatarUrl, hp, hpCurrent, hpTemp, ac, active } = sheet;
  return { id, name, race, class: className, level, ownerId, ownerName, avatarUrl, hp, hpCurrent, hpTemp, ac, active };
}

export const party: CharacterSummary[] = [
  partyMember(hazin),
  { ...partyMember(elara), id: 'lyra', name: 'Lyra Ventoclaro', class: 'Clériga', ownerId: 'ana', ownerName: 'Ana Beatriz', hpCurrent: 22, hp: 38, hpTemp: 5, avatarUrl: null },
  { ...partyMember(tobias), id: 'kael', name: 'Kael Sombra', class: 'Patrulheiro', ownerId: 'bruno', ownerName: 'Bruno', hpCurrent: 30, hp: 36, active: true },
  { ...partyMember(hazin), id: 'brisa', name: 'Capitã Brisa', class: 'Guerreira', ownerId: 'carla', ownerName: 'Carla', hpCurrent: 7, hp: 40 },
];
