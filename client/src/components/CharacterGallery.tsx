import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { MyCharacter } from '@quest-fast/shared';
import { CharacterPortrait } from './CharacterPortrait';
import { CharacterShowcase } from './CharacterShowcase';
import { HeroCard } from './HeroCard';
import { HpMeter } from './HpMeter';

const slot = 'grid min-w-0 cursor-pointer gap-1.5 rounded-panel border border-border bg-card p-1.5 text-start text-foreground transition-[border-color,transform] duration-(--duration-quick) ease-settle hover:border-input motion-safe:active:scale-[0.97]';
const NEXT: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

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
    <div className="grid content-start gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
      <div ref={group} role="radiogroup" aria-label="Meus personagens" onKeyDown={onKeyDown} className="contents">
        {characters.map((character) => {
          const checked = character.id === selectedId;
          return (
            <button key={character.id} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1}
              data-id={character.id} onClick={() => onSelect(character.id)}
              aria-label={`${character.name}, ${character.class} nível ${character.level}, ${character.campaignName}`}
              className={`${slot} aria-checked:border-accent-text aria-checked:shadow-[0_0_0_1px_var(--color-accent-text)]`}>
              <span className="relative block">
                <CharacterPortrait name={character.name} src={character.avatarUrl}
                  className="aspect-[3/4] rounded-control border border-border" initialsClassName="text-[28px] leading-none" />
                <span className="absolute bottom-1 left-1 rounded-[4px] border border-border-strong bg-surface-secret px-1 py-0.5 font-mono text-micro font-semibold leading-none">
                  NV {character.level}
                </span>
              </span>
              <span className="truncate px-0.5 font-display text-small font-semibold">{character.name}</span>
              <span className="truncate px-0.5 text-micro text-text-muted">{character.campaignName}</span>
              <HpMeter current={character.hpCurrent} max={character.hp} temp={character.hpTemp} className="h-1" />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onCreate} className={`${slot} border-dashed bg-transparent`}>
        <span className="grid aspect-[3/4] place-items-center rounded-control border border-dashed border-border-strong text-text-secondary">
          <Plus size={28} aria-hidden="true" />
        </span>
        <span className="px-0.5 font-display text-small font-semibold">Novo</span>
        <span className="px-0.5 text-micro text-text-muted">ou importar PDF</span>
      </button>
    </div>
  );
}

function NewCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" onClick={onCreate}
      className="grid min-h-72 cursor-pointer place-items-center rounded-panel border border-dashed border-border-strong bg-transparent p-5 text-center text-text-secondary transition-[border-color,transform] duration-(--duration-quick) ease-settle hover:border-input motion-safe:active:scale-[0.99]">
      <span className="grid justify-items-center gap-2.5">
        <span className="grid size-12 place-items-center rounded-full border border-dashed border-input text-foreground">
          <Plus size={20} aria-hidden="true" />
        </span>
        <b className="font-display text-foreground">Novo personagem</b>
        <span className="text-small text-text-muted">Escolha a campanha e comece do zero ou pelo PDF da ficha oficial</span>
      </span>
    </button>
  );
}

/**
 * The account gallery. Wide, a row of portraits picks the character shown in
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
      <div className="hidden @min-[760px]:grid @min-[760px]:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)] @min-[760px]:items-start @min-[760px]:gap-4">
        <Roster characters={characters} selectedId={selected.id} onSelect={onSelect} onCreate={onCreate} />
        <CharacterShowcase key={selected.id} character={selected} onOpen={() => onOpen(selected)} actions={actions?.(selected)} />
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] @min-[760px]:hidden">
        {characters.map((character) => (
          <HeroCard key={character.id} character={character} onOpen={() => onOpen(character)} actions={actions?.(character)} />
        ))}
        <NewCard onCreate={onCreate} />
      </div>
    </div>
  );
}
