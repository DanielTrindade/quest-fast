import { Heart, Shield } from '@phosphor-icons/react';
import type { CharacterSummary } from '@quest-fast/shared';
import { Avatar } from './Avatar';
import { Badge } from './ui/badge';

const stat = 'inline-flex items-center gap-1 rounded-control border border-border bg-card px-2 py-1 font-mono text-small text-text-secondary tabular-nums data-down:border-danger-text data-down:text-danger-text [&>svg]:text-text-muted';

/** One row of the campaign roster: identity, class/level and the public HP/CA. */
export function CharacterRow({ character, isMine, onOpen }: {
  character: CharacterSummary;
  isMine: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex min-h-14 w-full min-w-0 cursor-pointer flex-wrap items-center gap-3 rounded-control bg-transparent px-2 py-3 text-start text-foreground transition-[background-color] duration-(--duration-quick) ease-settle hover:bg-muted">
        <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="md" />
        <span className="grid min-w-0 flex-[1_1_140px] gap-0.5">
          <span className="flex min-w-0 flex-wrap items-baseline gap-2">
            <b className="font-semibold [overflow-wrap:anywhere]">{character.name}</b>
            {isMine && <Badge variant="accent" className="rounded-full text-micro">Seu personagem</Badge>}
          </span>
          <span className="text-small text-text-secondary [overflow-wrap:anywhere]">
            {character.race} · {character.class} · nível {character.level}
          </span>
          <span className="text-micro text-text-muted">{character.ownerName}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className={stat} data-down={character.hpCurrent === 0 || undefined}
            title={`${character.hpCurrent} de ${character.hp} PV${character.hpTemp > 0 ? `, ${character.hpTemp} temporários` : ''}`}>
            <Heart size={14} aria-hidden="true" />
            <span className="sr-only">PV </span>
            {character.hpCurrent}
            <span aria-hidden="true">/</span>
            <span className="sr-only"> de </span>
            {character.hp}
            {character.hpTemp > 0 && (
              <span className="text-accent-text">
                <span aria-hidden="true">+{character.hpTemp}</span>
                <span className="sr-only">, {character.hpTemp} temporários</span>
              </span>
            )}
          </span>
          <span className={stat} title={`${character.ac} de CA`}>
            <Shield size={14} aria-hidden="true" />
            <span className="sr-only">CA </span>
            {character.ac}
          </span>
        </span>
      </button>
    </li>
  );
}