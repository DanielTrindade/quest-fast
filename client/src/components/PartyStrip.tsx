import type { CharacterSummary } from '@quest-fast/shared';
import { classLine } from '../lib/character-lines';
import { hpLabel, isDown } from '../lib/hit-points';
import { cn } from '../lib/utils';
import { ArmorShield } from './ArmorShield';
import { Avatar } from './Avatar';
import { HpMeter } from './HpMeter';

/**
 * The group of a campaign: each player's active character as a short sheet,
 * token, who plays it, armour class and hit points. Opening one shows the
 * sheet for reading; play happens on the table.
 */
export function PartyStrip({ characters, currentUserId, onOpen }: {
  characters: CharacterSummary[]; currentUserId?: string; onOpen: (character: CharacterSummary) => void;
}) {
  return (
    <ul data-slot="party-strip" aria-label="O grupo"
      className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]">
      {characters.map((character) => {
        const mine = character.ownerId === currentUserId;
        const { hp, hpCurrent, hpTemp } = character;
        const down = isDown(hpCurrent);
        return (
          <li key={character.id} className="min-w-0">
            <button type="button" onClick={() => onOpen(character)} data-mine={mine || undefined}
              className="relative grid w-full min-w-0 cursor-pointer gap-3 rounded-panel border border-border-strong bg-card p-3 text-start text-foreground edge-raised transition-[background-color,border-color] duration-(--duration-quick) ease-settle hover:border-input hover:bg-muted data-mine:border-accent-text/60">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-display font-semibold">{character.name}</span>
                  <span className="truncate text-small text-text-secondary">{classLine(character)}</span>
                  <span className="truncate text-micro text-text-muted">{mine ? 'Seu personagem' : `Jogado por ${character.ownerName}`}</span>
                </span>
                <ArmorShield value={character.ac} size="sm" />
              </span>
              <span className="grid gap-1">
                <span className="flex items-baseline justify-between gap-2 text-micro text-text-muted">
                  <span>Pontos de vida{down && ', caído'}</span>
                  <span className={cn('font-mono text-small font-semibold tabular-nums', down ? 'text-danger-text' : 'text-foreground')}>
                    <span aria-hidden="true">{hpCurrent}{hpTemp > 0 && ` +${hpTemp}`} / {hp}</span>
                    <span className="sr-only">{hpLabel(hpCurrent, hp, hpTemp)}</span>
                  </span>
                </span>
                <HpMeter current={hpCurrent} max={hp} temp={hpTemp} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
