import { Heart, Shield } from '@phosphor-icons/react';
import type { CharacterSummary } from '@quest-fast/shared';
import { Avatar } from './Avatar';

/** One row of the campaign roster: identity, class/level and the public HP/CA. */
export function CharacterRow({ character, isMine, onOpen }: {
  character: CharacterSummary;
  isMine: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" className="character-row" onClick={onOpen}>
        <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="md" />
        <span className="character-row__info">
          <span className="character-row__name">
            <b>{character.name}</b>
            {isMine && <span className="character-row__mine">Seu personagem</span>}
          </span>
          <span className="character-row__class">
            {character.race} · {character.class} · nível {character.level}
          </span>
          <span className="character-row__owner">{character.ownerName}</span>
        </span>
        <span className="character-row__stats">
          <span className="character-row__stat" data-down={character.hpCurrent === 0 || undefined}
            title={`${character.hpCurrent} de ${character.hp} PV${character.hpTemp > 0 ? `, ${character.hpTemp} temporários` : ''}`}>
            <Heart size={14} aria-hidden="true" />
            <span className="sr-only">PV </span>
            {character.hpCurrent}
            <span aria-hidden="true">/</span>
            <span className="sr-only"> de </span>
            {character.hp}
            {character.hpTemp > 0 && (
              <span className="character-row__temp">
                <span aria-hidden="true">+{character.hpTemp}</span>
                <span className="sr-only">, {character.hpTemp} temporários</span>
              </span>
            )}
          </span>
          <span className="character-row__stat" title={`${character.ac} de CA`}>
            <Shield size={14} aria-hidden="true" />
            <span className="sr-only">CA </span>
            {character.ac}
          </span>
        </span>
      </button>
    </li>
  );
}