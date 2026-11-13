import { SIZES, initials, type TokenView } from '@quest-fast/shared';
import type { PickerCharacter, PickerEncounter, PickerStatblock } from '../../components/TokenPicker';
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
function cell(column: number, row: number) {
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
    initials: initials(fields.name),
    characterId: fields.kind === 'character' ? `c-${id}` : null,
    combatantId: fields.kind === 'combatant' ? `cb-${id}` : null,
    statblockId: null,
    ownerId: null,
    hidden: false,
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
