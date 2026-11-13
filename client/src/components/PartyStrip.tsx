import type { CharacterSummary } from '@quest-fast/shared';
import { initials } from '../lib/initials';
import { CharacterPortrait } from './CharacterPortrait';
import { hpLabel } from '../lib/hit-points';
import { HpMeter } from './HpMeter';

/**
 * The group of a campaign as medallions: each player's active character, to
 * look at. A medallion opens the sheet for reading; play happens on the table.
 */
export function PartyStrip({ characters, currentUserId, onOpen }: {
  characters: CharacterSummary[]; currentUserId?: string; onOpen: (character: CharacterSummary) => void;
}) {
  return (
    <ul data-slot="party-strip" aria-label="O grupo" className="m-0 flex list-none flex-wrap gap-x-6 gap-y-5 p-0">
      {characters.map((character) => {
        const mine = character.ownerId === currentUserId;
        return (
          <li key={character.id} className="w-26">
            <button type="button" onClick={() => onOpen(character)} data-mine={mine || undefined}
              className="group grid w-full cursor-pointer justify-items-center gap-2 bg-transparent p-0 text-center text-foreground transition-transform duration-(--duration-quick) ease-settle motion-safe:active:scale-[0.97]">
              <CharacterPortrait name={character.name} src={character.avatarUrl}
                className="size-18 rounded-full shadow-[0_0_0_2px_var(--color-surface),0_0_0_3px_var(--color-border-strong)] transition-[box-shadow] duration-(--duration-quick) ease-settle group-hover:shadow-[0_0_0_2px_var(--color-surface),0_0_0_3px_var(--color-border-control)] group-data-mine:shadow-[0_0_0_2px_var(--color-surface),0_0_0_3px_var(--color-accent-text)]"
                initialsClassName="text-h1" />
              <span className="relative -mt-4.5 grid w-full gap-px rounded-control border border-border-strong bg-card px-2 py-1">
                <b className="truncate font-display text-small font-semibold" title={character.name}>
                  {character.name.split(' ')[0] || initials(character.name)}
                </b>
                <span className="truncate font-mono text-micro text-text-muted">{character.class} {character.level}</span>
              </span>
              <HpMeter current={character.hpCurrent} max={character.hp} temp={character.hpTemp} className="h-1 w-full" />
              <span className="sr-only">
                {character.name}, de {character.ownerName}{mine ? ' (seu)' : ''}. {hpLabel(character.hpCurrent, character.hp, character.hpTemp)}. Abrir ficha.
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
