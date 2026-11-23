import { SIZES, initials, type TokenView } from '@quest-fast/shared';
import type { PickerCharacter, PickerEncounter, PickerStatblock } from '../../components/TokenPicker';
import type { FightMarks, TokenHealth } from '../../lib/token-combat';
import { PRINTED_CELL, PRINTED_OFFSET, SYNTHETIC_MAP } from './maps';

export const MASTER_ID = 'u-lia';
export const PLAYER_ID = 'u-rafael';
const OTHER_PLAYER_ID = 'u-bia';

let avatar: string | null = null;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A portrait drawn in code, for the token with an avatar: never a player's picture. */
export function syntheticAvatarUrl(): string {
  if (avatar) return avatar;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d')!;
  context.fillStyle = token('--color-accent');
  context.fillRect(0, 0, 96, 96);
  context.fillStyle = token('--color-surface-raised');
  context.beginPath();
  context.arc(48, 38, 20, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(48, 96, 34, 30, 0, 0, Math.PI * 2);
  context.fill();
  avatar = canvas.toDataURL('image/png');
  return avatar;
}

/** The centre of the printed cell (column, row), as the server snaps a medium token. */
export function cell(column: number, row: number) {
  return { x: PRINTED_OFFSET + (column + 0.5) * PRINTED_CELL, y: PRINTED_OFFSET + (row + 0.5) * PRINTED_CELL };
}

/** The corner between four printed cells, where a large token rests. */
function junction(column: number, row: number) {
  return { x: PRINTED_OFFSET + column * PRINTED_CELL, y: PRINTED_OFFSET + row * PRINTED_CELL };
}

function make(id: string, fields: Partial<TokenView> & Pick<TokenView, 'name' | 'kind' | 'x' | 'y'>): TokenView {
  return {
    id,
    size: 'medium',
    avatarUrl: null,
    vitality: 'up',
    initials: initials(fields.name),
    characterId: fields.kind === 'character' ? `c-${id}` : null,
    combatantId: fields.kind === 'combatant' ? `cb-${id}` : null,
    encounterId: null,
    statblockId: null,
    ownerId: null,
    hidden: false,
    combatantHidden: false,
    movingBy: null,
    reach: null,
    ...fields,
  };
}

/**
 * The party at the ruined hall of the synthetic map: two characters (one with
 * an avatar), goblins, an ogre, a free barrel, and what only the master sees:
 * a hidden bandit. Mira is being moved by her player.
 */
export function masterTokens(): TokenView[] {
  return [
    make('kaelen', { name: 'Kaelen', kind: 'character', ownerId: PLAYER_ID, avatarUrl: syntheticAvatarUrl(), ...cell(17, 4) }),
    make('mira', { name: 'Mira Folhaverde', kind: 'character', ownerId: OTHER_PLAYER_ID, ...cell(18, 5), movingBy: { userId: OTHER_PLAYER_ID, name: 'Bia Souza' } }),
    make('goblin-1', { name: 'Goblin 1', kind: 'combatant', size: 'small', ...cell(21, 3) }),
    make('goblin-2', { name: 'Goblin 2', kind: 'combatant', size: 'small', ...cell(22, 6) }),
    make('ogre', { name: 'Ogro', kind: 'combatant', size: 'large', ...junction(25, 6) }),
    make('barrel', { name: 'Barril de pólvora', kind: 'free', ...cell(16, 7) }),
    make('bandit', { name: 'Bandido', kind: 'combatant', hidden: true, ...cell(24, 3) }),
  ];
}

/**
 * The same party in a fight, on Kaelen's turn: Kaelen has walked half of
 * his 9 m; the creatures still have all of theirs; the barrel walks nowhere.
 */
export function fightTokens(): TokenView[] {
  const reach: Record<string, TokenView['reach']> = {
    kaelen: { speed: 9, left: 4.5 },
    mira: { speed: 9, left: 9 },
    'goblin-1': { speed: 9, left: 9 },
    'goblin-2': { speed: 9, left: 9 },
    ogre: { speed: 12, left: 12 },
    bandit: { speed: 9, left: 9 },
  };
  return masterTokens().map((candidate) => ({ ...candidate, movingBy: null, reach: reach[candidate.id] ?? null }));
}

/**
 * Late in the fight: Mira is down making death saves and Goblin 1 is
 * defeated, lying on the cell the ogre is about to step on.
 */
export function vitalityTokens(): TokenView[] {
  return fightTokens().map((candidate) => {
    if (candidate.id === 'mira') return { ...candidate, vitality: 'down' as const };
    if (candidate.id === 'goblin-1') return { ...candidate, vitality: 'defeated' as const, avatarUrl: syntheticAvatarUrl() };
    return candidate;
  });
}

/** What a player receives in the fight: no hidden token, and no creature's reach. */
export function playerFightTokens(): TokenView[] {
  return fightTokens()
    .filter((candidate) => !candidate.hidden)
    .map((candidate) => (candidate.kind === 'character' ? candidate : { ...candidate, reach: null }));
}

/** What a player receives: the server leaves the hidden ones out. */
export function playerTokens(): TokenView[] {
  return masterTokens().filter((candidate) => !candidate.hidden);
}

/** The most a scene holds, spread over the map in every size. */
export function manyTokens(): TokenView[] {
  const columns = 20;
  return Array.from({ length: 200 }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const kind = index % 3 === 0 ? 'combatant' : index % 3 === 1 ? 'free' : 'character';
    return make(`t-${index}`, {
      name: kind === 'character' ? `Aventureiro ${index + 1}` : kind === 'combatant' ? `Esqueleto ${index + 1}` : `Caixote ${index + 1}`,
      kind,
      size: SIZES[index % SIZES.length],
      hidden: index % 17 === 0,
      x: 45 + column * ((SYNTHETIC_MAP.width - 90) / (columns - 1)),
      y: 60 + row * ((SYNTHETIC_MAP.height - 120) / 9),
    });
  });
}

export const pickerCharacters: PickerCharacter[] = [
  { id: 'c-kaelen', name: 'Kaelen', ownerName: 'Rafael Costa', avatarUrl: null, onScene: true },
  { id: 'c-mira', name: 'Mira Folhaverde', ownerName: 'Bia Souza', avatarUrl: null, onScene: false },
  { id: 'c-long', name: 'Aldric Vanthorne, Guardião Esquecido das Catacumbas', ownerName: 'Pedro Alves', avatarUrl: null, onScene: false },
];

export const pickerEncounters: PickerEncounter[] = [
  {
    id: 'e-ambush',
    name: 'Emboscada na estrada',
    active: true,
    combatants: [
      { id: 'cb-kaelen', name: 'Kaelen', hidden: false, character: true, onScene: true },
      { id: 'cb-goblin-1', name: 'Goblin 1', hidden: false, character: false, onScene: false },
      { id: 'cb-goblin-2', name: 'Goblin 2', hidden: false, character: false, onScene: false },
      { id: 'cb-bandit', name: 'Bandido', hidden: true, character: false, onScene: false },
    ],
  },
  {
    id: 'e-crypt',
    name: 'Cripta',
    active: false,
    combatants: [{ id: 'cb-skeleton', name: 'Esqueleto', hidden: false, character: false, onScene: true }],
  },
];

export const pickerStatblocks: PickerStatblock[] = [
  { id: 'sb-goblin', name: 'Goblin', size: 'small' },
  { id: 'sb-ogre', name: 'Ogro', size: 'large' },
];

/**
 * The worst table of the data lab: the longest names the sheets and the
 * bestiary accept, a free label at its limit, a token with a broken avatar,
 * one being dragged by a player with a long name, the dead and the hidden.
 * Linked to the worst encounter's combatants by id.
 */
export function worstTokens(names: { guardian: string; thalindra: string; mover: { userId: string; name: string } }): TokenView[] {
  return [
    make('w-guardian', { name: names.guardian, kind: 'combatant', combatantId: 'w-fast', size: 'gargantuan', ...junction(22, 6) }),
    make('w-thal', { name: names.thalindra, kind: 'character', characterId: 'thalindra', combatantId: null, ownerId: names.mover.userId, avatarUrl: '/avatars/removido-do-discord.png', ...cell(16, 5), movingBy: names.mover }),
    make('w-bo', { name: 'Bo', kind: 'character', characterId: 'bo', ownerId: 'jo', vitality: 'down', ...cell(17, 6) }),
    make('w-hidden', { name: 'Bandido escondido atrás da carroça tombada', kind: 'combatant', combatantId: 'w-hidden', hidden: true, ...cell(19, 3) }),
    make('w-rat', { name: 'Rato 1', kind: 'combatant', combatantId: 'w-def', size: 'tiny', vitality: 'defeated', ...cell(18, 7) }),
    make('w-free', { name: 'Carroça tombada e barris de pólvora seca', kind: 'free', size: 'large', ...junction(14, 8) }),
    make('w-ar', { name: 'محمد العلي', kind: 'free', ...cell(15, 3) }),
  ];
}

/**
 * The fight's marks on Kaelen's turn: Kaelen whole, Mira hurt, Goblin 1
 * nearly down, Goblin 2 untouched, the ogre bloodied. The barrel is not in
 * the fight; the bandit only on the master's map.
 */
export function fightMarksFor(tokens: readonly TokenView[], turn = 'kaelen'): FightMarks {
  const health: Record<string, TokenHealth> = {
    kaelen: { band: 'unhurt', fraction: 1 },
    mira: { band: 'wounded', fraction: 0.7 },
    'goblin-1': { band: 'bloodied', fraction: 0.15 },
    'goblin-2': { band: 'unhurt', fraction: 1 },
    ogre: { band: 'bloodied', fraction: 0.45 },
    bandit: { band: 'unhurt', fraction: 1 },
  };
  return new Map(tokens.filter((candidate) => candidate.id in health)
    .map((candidate) => [candidate.id, { turn: candidate.id === turn, health: candidate.vitality === 'up' ? health[candidate.id] : null }]));
}
