import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { MyCharacter } from '@quest-fast/shared';
import { classLine } from '../lib/character-lines';
import { Avatar } from './Avatar';
import { CharacterShowcase } from './CharacterShowcase';
import { HeroCard } from './HeroCard';
import { HpMeter } from './HpMeter';

const NEXT: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
// The selected row carries the same accent rule as the active encounter.
const row = 'relative flex min-h-16 w-full min-w-0 cursor-pointer items-center gap-3 rounded-control border border-transparent bg-transparent py-2 pr-3 pl-4 text-start text-foreground transition-[background-color,border-color] duration-(--duration-quick) ease-settle hover:bg-muted';

function Roster({ characters, selectedId, onSelect, onCreate }: {
  characters: MyCharacter[]; selectedId: string; onSelect: (id: string) => void; onCreate: () => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  // A radio group moves with the arrows and keeps one stop in the tab order.
  const onKeyDown = (event: KeyboardEvent) => {
    const step = NEXT[event.key];
    if (!step) return;
    event.preventDefault();
    const index = characters.findIndex((character) => character.id === selectedId);
    const next = characters[(index + step + characters.length) % characters.length];
    onSelect(next.id);
    group.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  };

  return (
    <div className="grid content-start gap-1">
      <div ref={group} role="radiogroup" aria-label="Meus personagens" onKeyDown={onKeyDown} className="grid gap-1">
        {characters.map((character) => {
          const checked = character.id === selectedId;
          return (
            <button key={character.id} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1}
              data-id={character.id} onClick={() => onSelect(character.id)}
              aria-label={`${character.name}, ${classLine(character)}, ${character.campaignName}`}
              className={`${row} aria-checked:border-border-strong aria-checked:bg-card aria-checked:edge-raised aria-checked:before:absolute aria-checked:before:inset-y-2 aria-checked:before:left-1 aria-checked:before:w-0.5 aria-checked:before:rounded-full aria-checked:before:bg-accent-text`}>
              <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" />
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="truncate font-display font-semibold">{character.name}</span>
                <span className="truncate text-micro text-text-muted">{classLine(character)}, {character.campaignName}</span>
                <HpMeter current={character.hpCurrent} max={character.hp} temp={character.hpTemp} className="h-1" />
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onCreate}
        className={`${row} mt-1 border-dashed border-border-strong text-text-secondary hover:text-foreground`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-input">
          <Plus size={18} aria-hidden="true" />
        </span>
        <span className="grid gap-0.5">
          <span className="font-display font-semibold">Novo personagem</span>
          <span className="text-micro text-text-muted">Do zero ou pelo PDF da ficha</span>
        </span>
      </button>
    </div>
  );
}

function NewCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" onClick={onCreate}
      className="grid min-h-40 cursor-pointer place-items-center rounded-panel border border-dashed border-border-strong bg-transparent p-5 text-center text-text-secondary transition-[background-color,transform] duration-(--duration-quick) ease-settle hover:bg-muted motion-safe:active:scale-[0.98]">
      <span className="grid justify-items-center gap-2">
        <span className="grid size-10 place-items-center rounded-full border border-dashed border-input text-foreground">
          <Plus size={18} aria-hidden="true" />
        </span>
        <b className="font-display text-foreground">Novo personagem</b>
        <span className="text-small text-text-muted">Escolha a campanha e comece do zero ou pelo PDF da ficha</span>
      </span>
    </button>
  );
}

/**
 * The account gallery. Wide, a list of tokens picks the character shown in
 * the showcase; narrow, every character is a card. The two layouts switch on
 * the container, so the same screen works beside a sidebar or on a phone.
 */
export function CharacterGallery({ characters, selectedId, onSelect, onOpen, onCreate, actions }: {
  characters: MyCharacter[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (character: MyCharacter) => void;
  onCreate: () => void;
  actions?: (character: MyCharacter) => ReactNode;
}) {
  const selected = characters.find((character) => character.id === selectedId) ?? characters[0];
  if (!selected) return null;
  return (
    <div data-slot="character-gallery" className="@container min-w-0">
      <div className="hidden @min-[760px]:grid @min-[760px]:grid-cols-[minmax(220px,0.55fr)_minmax(0,1.6fr)] @min-[760px]:items-start @min-[760px]:gap-6">
        <Roster characters={characters} selectedId={selected.id} onSelect={onSelect} onCreate={onCreate} />
        {/* Sticky, so picking from a long list never changes it out of sight. */}
        <div className="sticky top-4 min-w-0">
          <CharacterShowcase character={selected} onOpen={() => onOpen(selected)} actions={actions?.(selected)} />
        </div>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] @min-[760px]:hidden">
        {characters.map((character) => (
          <HeroCard key={character.id} character={character} onOpen={() => onOpen(character)} actions={actions?.(character)} />
        ))}
        <NewCard onCreate={onCreate} />
      </div>
    </div>
  );
}
