import { useId, useState, type ReactNode } from 'react';
import { Ghost, IdentificationCard, UserCircleDashed, X } from '@phosphor-icons/react';
import type { CastChoice, CharacterSheet, CharacterSummary, CombatantView, LinkedRollRequest, RollPayload, SummonInput } from '@quest-fast/shared';
import { useRangeToggle } from '../hooks/useRangeToggle';
import { classLine } from '../lib/character-lines';
import { contentKeys } from '../lib/content-keys';
import { ArmorShield } from './ArmorShield';
import { AttackCard } from './AttackCard';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { CombatantControls } from './CombatantControls';
import { EmptyState } from './EmptyState';
import { HpMeter } from './HpMeter';
import { LinkedRollResult } from './LinkedRollResult';
import type { InitiativeActions } from './InitiativeList';
import { QuickTests } from './QuickTests';
import { Skeleton } from './Skeleton';
import { SpellCaster } from './SpellCaster';
import { SummonForm } from './SummonForm';
import { segmentedGroup, segmentedRadio } from './ui/segmented';

export type PlayerCharacter = Pick<CharacterSummary, 'name' | 'class' | 'level' | 'ac' | 'hp' | 'hpCurrent' | 'hpTemp' | 'avatarUrl'>;

/** The player's own character in the fight in progress, and what they may do with it. */
export type PlayerFight = {
  combatant: CombatantView;
  targets: CombatantView[];
  active: boolean;
  busy: boolean;
  actions: InitiativeActions;
};

/** The creatures a player controls in the fight (#114), and the "Invocar" form. */
export type PlayerSummons = {
  /** Each creature this player controls, as `fight` gives the character. */
  controlled: PlayerFight[];
  /** Takes a creature out of the fight. */
  onDismiss: (combatantId: string) => void;
  /** While the character fights: a summon from a simple sheet. */
  summon?: {
    pending: boolean;
    error: string | null;
    /** Resolves when the server accepted. */
    onSummon: (input: SummonInput) => Promise<unknown> | void;
  };
};

/**
 * "Agir com": the character or one of the creatures its player controls. It
 * follows whose turn it is until the player picks one; the server checks.
 */
function ActWith({ fights, selectedId, onSelect }: { fights: PlayerFight[]; selectedId: string; onSelect: (id: string) => void }) {
  const name = useId();
  return (
    <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-small font-semibold text-text-secondary">Agir com</legend>
      <div className={segmentedGroup}>
        {fights.map(({ combatant, active }) => (
          <label key={combatant.id} className={segmentedRadio}>
            <input type="radio" name={name} value={combatant.id} checked={combatant.id === selectedId} onChange={() => onSelect(combatant.id)} />
            <span className="[overflow-wrap:anywhere]">{combatant.name}{active && <span className="sr-only"> (vez atual)</span>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The fight half of the tab: who acts, its controls, and the summons. */
function FightControls({ fight, summons }: { fight: PlayerFight; summons?: PlayerSummons }) {
  const fights = [fight, ...(summons?.controlled ?? [])];
  // Null follows the turn: whoever of these acts now, else the character.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [summoning, setSummoning] = useState(false);
  const selected = fights.find(({ combatant }) => combatant.id === pickedId) ?? fights.find(({ active }) => active) ?? fight;
  const creature = selected !== fight ? selected : null;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {fights.length > 1 && <ActWith fights={fights} selectedId={selected.combatant.id} onSelect={setPickedId} />}
      <CombatantControls key={selected.combatant.id} combatant={selected.combatant} targets={selected.targets} master={false}
        active={selected.active} busy={selected.busy} actions={selected.actions} />
      {creature && summons && (
        <div className="[&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
          <Button variant="secondary" disabled={creature.busy} onClick={() => {
            setPickedId(null);
            summons.onDismiss(creature.combatant.id);
          }}>
            <X size={18} aria-hidden="true" /> Dispensar {creature.combatant.name}
          </Button>
        </div>
      )}
      {!creature && summons?.summon && (
        summoning ? (
          <section aria-label="Invocar" className="grid min-w-0 gap-3 rounded-panel border border-border bg-background p-3">
            <h4 className="m-0 font-display text-h2 font-semibold">Invocar</h4>
            <SummonForm summoner={fight.combatant} pending={summons.summon.pending} error={summons.summon.error}
              onCancel={() => setSummoning(false)}
              onSummon={async (input) => {
                await summons.summon!.onSummon(input);
                setSummoning(false);
              }} />
          </section>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setSummoning(true)}>
              <Ghost size={18} aria-hidden="true" /> Invocar
            </Button>
          </div>
        )
      )}
    </div>
  );
}

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
          <LinkedRollResult payload={lastRoll} name={name} />
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
/** Slots to spend or spells that spend them: cantrips alone need no section. */
function hasMagic(sheet: CharacterSheet): boolean {
  return sheet.spellSlots.some((slot) => slot.total > 0) || sheet.spells.some((spell) => spell.level >= 1);
}

export function PlayerActions({
  character,
  sheet,
  sheetError = null,
  retryingSheet = false,
  onRetrySheet,
  fight = null,
  inOtherFight = false,
  rolling = false,
  rollError = null,
  lastRoll = null,
  onRoll,
  onOpenSheet,
  galleryAction,
  spellcasting,
  summons,
}: {
  /** Null when the player has no active character in this campaign. */
  character: PlayerCharacter | null;
  /** The full sheet, for tests and attacks; undefined while it loads or after it failed. */
  sheet?: CharacterSheet;
  /** Why the sheet did not load, once the retries are over. */
  sheetError?: string | null;
  retryingSheet?: boolean;
  onRetrySheet?: () => void;
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
  /** Slots adjusted by hand and spells cast; without it, the section stays out. */
  spellcasting?: {
    pending: boolean;
    error: string | null;
    onChangeSlots: (spent: number[]) => void;
    onCast: (spellIndex: number, spellName: string, choice: CastChoice) => void;
  };
  /** In a fight: the creatures this player controls and "Invocar" (#114). */
  summons?: PlayerSummons;
}) {
  // Out of a fight the character attacks from its own token, when it has one on the map.
  const ranges = useRangeToggle(sheet && !fight ? { characterId: sheet.id, combatantId: null } : null);
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
        <FightControls fight={fight} summons={summons} />
      ) : (
        <>
          <CharacterHead character={character} note={inOtherFight ? 'Fora do combate em andamento.' : null} />
          {sheet && sheet.attacks.length > 0 && (
            <section aria-label={`Ataques de ${character.name}`} className="grid min-w-0 gap-2">
              <h4 className="m-0 text-small font-semibold text-text-secondary">Atacar</h4>
              <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0">
                {contentKeys(sheet.attacks).map(({ item: attack, key }, index) => (
                  <li key={key}>
                    <AttackCard {...attack} disabled={rolling} rangeToggle={ranges.offer(`${index}:${attack.name}`, attack.range)}
                      onRoll={() => {
                        ranges.clear();
                        onRoll({ kind: 'attack', attackIndex: index, mode: 'normal' });
                      }} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {sheet && spellcasting && hasMagic(sheet) && (
        <div className="grid min-w-0 border-t border-border pt-4">
          <SpellCaster name={character.name} slots={sheet.spellSlots} spells={sheet.spells} concentrating={sheet.concentrating}
            pending={spellcasting.pending} error={spellcasting.error}
            onChangeSlots={spellcasting.onChangeSlots} onCast={spellcasting.onCast} />
        </div>
      )}

      <div className="grid min-w-0 gap-3 border-t border-border pt-4">
        {sheet
          ? <QuickTests sheet={sheet} pending={rolling} onRoll={onRoll} />
          : sheetError
            ? (
              <div className="grid justify-items-start gap-3">
                <p role="alert" className="m-0 text-small text-danger-text">{sheetError}</p>
                {onRetrySheet && <Button variant="secondary" loading={retryingSheet} onClick={onRetrySheet}>Tentar novamente</Button>}
              </div>
            )
            : <Skeleton shape="panel" label="Carregando a ficha…" />}
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
