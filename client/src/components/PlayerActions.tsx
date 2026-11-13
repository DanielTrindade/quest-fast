import type { ReactNode } from 'react';
import { IdentificationCard, UserCircleDashed } from '@phosphor-icons/react';
import type { CharacterSheet, CharacterSummary, CombatantView, LinkedRollRequest, RollPayload } from '@quest-fast/shared';
import { classLine } from '../lib/character-lines';
import { contentKeys } from '../lib/content-keys';
import { rollActionLabel, rollDecomposition } from '../lib/roll-labels';
import { ArmorShield } from './ArmorShield';
import { AttackCard } from './AttackCard';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { CombatantControls } from './CombatantControls';
import { DiceResult } from './DiceResult';
import { EmptyState } from './EmptyState';
import { HpMeter } from './HpMeter';
import type { InitiativeActions } from './InitiativeList';
import { QuickTests } from './QuickTests';
import { Skeleton } from './Skeleton';

export type PlayerCharacter = Pick<CharacterSummary, 'name' | 'class' | 'level' | 'ac' | 'hp' | 'hpCurrent' | 'hpTemp' | 'avatarUrl'>;

/** The player's own character in the fight in progress, and what they may do with it. */
export type PlayerFight = {
  combatant: CombatantView;
  targets: CombatantView[];
  active: boolean;
  busy: boolean;
  actions: InitiativeActions;
};

function CharacterHead({ character, note }: { character: PlayerCharacter; note: string | null }) {
  return (
    <header className="flex min-w-0 items-start gap-3">
      <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="md" />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid min-w-0 gap-0.5">
          <h3 className="m-0 font-display text-h2 font-semibold [overflow-wrap:anywhere]">{character.name}</h3>
          <p className="m-0 text-small text-text-secondary [overflow-wrap:anywhere]">{classLine(character)}</p>
        </div>
        <div className="grid min-w-0 gap-1">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-small text-text-secondary">
            <span>Pontos de vida</span>
            <span data-down={character.hpCurrent === 0 || undefined} className="font-mono text-body font-semibold text-foreground tabular-nums data-down:text-danger-text">
              {character.hpCurrent}<span className="text-text-secondary">/{character.hp}</span>
              {character.hpTemp > 0 && <span className="text-text-secondary"> +{character.hpTemp}<span className="sr-only"> temporários</span></span>}
            </span>
          </p>
          <HpMeter current={character.hpCurrent} max={character.hp} temp={character.hpTemp} />
        </div>
        {note && <p className="m-0 text-small text-text-muted">{note}</p>}
      </div>
      <ArmorShield value={character.ac} size="md" />
    </header>
  );
}

function RollOutcome({ name, rolling, rollError, lastRoll }: { name: string; rolling: boolean; rollError: string | null; lastRoll: RollPayload | null }) {
  return (
    <div aria-live="polite" className="grid min-w-0 gap-2 empty:hidden">
      {rolling && <Skeleton shape="panel" label="Rolando…" />}
      {!rolling && rollError && <p role="alert" className="m-0 text-small text-danger-text">{rollError}</p>}
      {!rolling && !rollError && lastRoll && (
        <div className="rounded-control border border-border bg-background px-3">
          <DiceResult label={`${rollActionLabel(lastRoll)} de ${name}`} total={lastRoll.total}
            decomposition={rollDecomposition(lastRoll)} dice={lastRoll.dice} mode={lastRoll.mode} natural={lastRoll.natural} />
        </div>
      )}
    </div>
  );
}

/**
 * The player's Ações tab: their active character in this campaign. In a
 * fight, the combatant as the queue draws it, with its attacks, hit points
 * and death saves; otherwise the character with its attacks. Then the quick
 * tests of the sheet. Only asks; the server rolls and authorizes.
 */
export function PlayerActions({
  character,
  sheet,
  fight = null,
  inOtherFight = false,
  rolling = false,
  rollError = null,
  lastRoll = null,
  onRoll,
  onOpenSheet,
  galleryAction,
}: {
  /** Null when the player has no active character in this campaign. */
  character: PlayerCharacter | null;
  /** The full sheet, for tests and attacks; undefined while it loads. */
  sheet?: CharacterSheet;
  fight?: PlayerFight | null;
  /** A fight is on and this character is not in it. */
  inOtherFight?: boolean;
  rolling?: boolean;
  rollError?: string | null;
  lastRoll?: RollPayload | null;
  onRoll: (request: LinkedRollRequest) => void;
  onOpenSheet: () => void;
  /** Where to activate a character: the account gallery. */
  galleryAction: ReactNode;
}) {
  if (!character) {
    return (
      <EmptyState icon={UserCircleDashed} title="Nenhum personagem ativo"
        description="Ative um personagem desta campanha em Meus personagens para agir por aqui. Os dados livres ficam na aba Dados."
        action={galleryAction} />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      {fight ? (
        <CombatantControls combatant={fight.combatant} targets={fight.targets} master={false} active={fight.active}
          busy={fight.busy} actions={fight.actions} />
      ) : (
        <>
          <CharacterHead character={character} note={inOtherFight ? 'Fora do combate em andamento.' : null} />
          {sheet && sheet.attacks.length > 0 && (
            <section aria-label={`Ataques de ${character.name}`} className="grid min-w-0 gap-2">
              <h4 className="m-0 text-small font-semibold text-text-secondary">Atacar</h4>
              <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0">
                {contentKeys(sheet.attacks).map(({ item: attack, key }, index) => (
                  <li key={key}>
                    <AttackCard {...attack} disabled={rolling}
                      onRoll={() => onRoll({ kind: 'attack', attackIndex: index, mode: 'normal' })} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="grid min-w-0 gap-3 border-t border-border pt-4">
        {sheet ? <QuickTests sheet={sheet} pending={rolling} onRoll={onRoll} /> : <Skeleton shape="panel" label="Carregando a ficha…" />}
        <RollOutcome name={character.name} rolling={rolling} rollError={rollError} lastRoll={lastRoll} />
      </div>

      <div>
        <Button variant="secondary" onClick={onOpenSheet}>
          <IdentificationCard size={18} aria-hidden="true" /> Abrir ficha
        </Button>
      </div>
    </div>
  );
}
