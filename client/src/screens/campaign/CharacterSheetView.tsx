import { useId, useState } from 'react';
import { Brain, PencilSimple, Trash, Warning } from '@phosphor-icons/react';
import {
  ABILITIES,
  SKILLS,
  SKILL_ABILITIES,
  abilityModifier,
  initiative,
  passivePerception,
  removeCondition,
  proficiencyBonus,
  saveBonus,
  setCondition,
  skillBonus,
  skillProficiency,
  spellAttackBonus,
  spellSaveDc,
  type Ability,
  type CharacterSheet,
  type CharacterStateInput,
  type LinkedRollRequest,
  type RollMode,
  type RollPayload,
  type Skill,
} from '@quest-fast/shared';
import { AbilityBlock } from '../../components/AbilityBlock';
import { AttackCard } from '../../components/AttackCard';
import { AttunedItems } from '../../components/AttunedItems';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { CoinPurse } from '../../components/CoinPurse';
import { ConditionPicker } from '../../components/ConditionPicker';
import { DeathSaves } from '../../components/DeathSaves';
import { DerivedStats } from '../../components/DerivedStats';
import { DiceResult } from '../../components/DiceResult';
import { EquipmentTraining } from '../../components/EquipmentTraining';
import { HeroicInspiration } from '../../components/HeroicInspiration';
import { HitDiceTracker } from '../../components/HitDiceTracker';
import { HitPointsTracker } from '../../components/HitPointsTracker';
import { RollModeControl } from '../../components/RollModeControl';
import { SheetIdentity } from '../../components/SheetIdentity';
import { SheetTabPanel, SheetTabs } from '../../components/SheetTabs';
import { Skeleton } from '../../components/Skeleton';
import { SpellList } from '../../components/SpellList';
import { SpellSlots } from '../../components/SpellSlots';
import { SpellcastingHeader } from '../../components/SpellcastingHeader';
import { Surface } from '../../components/Surface';
import { TraitList } from '../../components/TraitList';
import { conditionLabel } from '../../lib/combat-labels';
import { contentKeys } from '../../lib/content-keys';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, SKILL_LABELS } from '../../lib/5e';
import { dialogActions, sheetEmpty } from '../../components/layout-styles';
import { trackerLabel, trackerPanel } from '../../components/sheet-styles';

/** The skills printed under each ability, alphabetical as on the sheet. */
const SKILLS_BY_ABILITY = ABILITIES.reduce<Record<Ability, Skill[]>>(
  (groups, ability) => {
    groups[ability] = SKILLS.filter((skill) => SKILL_ABILITIES[skill] === ability)
      .sort((a, b) => SKILL_LABELS[a].localeCompare(SKILL_LABELS[b], 'pt-BR'));
    return groups;
  },
  { strength: [], dexterity: [], constitution: [], intelligence: [], wisdom: [], charisma: [] },
);

const TABS = [
  { id: 'character', label: 'Personagem' },
  { id: 'spells', label: 'Magias' },
  { id: 'inventory', label: 'Inventário e história' },
] as const;

function rollActionLabel(payload: RollPayload): string {
  if (payload.rollKind === 'attack') return `Ataque (${payload.attackName})`;
  if (payload.rollKind === 'skill') return `Teste de ${payload.skill ? SKILL_LABELS[payload.skill] : ''}`;
  if (payload.rollKind === 'check') return `Teste de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'save') return `Salvaguarda de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'initiative') return 'Iniciativa';
  if (payload.rollKind === 'spellAttack') return 'Ataque mágico';
  return 'Rolagem';
}

function decompose(payload: RollPayload) {
  const kept = payload.dice.filter((die) => !die.discarded).map((die) => `${die.value}`).join(' + ');
  if (payload.modifier === 0) return kept;
  return `${kept} ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
}

/** A linked roll: the sheet owns one mode for all of them, unless the roll says otherwise. */
type SheetRoll = (request: LinkedRollRequest) => void;

function SheetHead({ character, isOwner }: { character: CharacterSheet; isOwner: boolean }) {
  return (
    <div className="flex items-center gap-3 max-[479px]:flex-wrap">
      <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="lg" />
      <div className="grid min-w-0 flex-[1_1_280px] gap-1 text-text-secondary">
        <p className="text-small text-text-secondary">{isOwner ? 'Seu personagem' : `Ficha de ${character.ownerName}`}</p>
        <SheetIdentity backgroundName={character.background} species={character.race} className={character.class}
          subclass={character.subclass} level={character.level} experience={character.experience} />
      </div>
    </div>
  );
}

/** Armor class, hit points, hit dice, death saves and inspiration. */
function CombatTrackers({
  character,
  editable,
  pending,
  onChange,
}: {
  character: CharacterSheet;
  editable: boolean;
  pending: boolean;
  onChange: (state: CharacterStateInput) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 *:flex-[1_1_160px] [&>[data-slot=hit-points]]:flex-[2_1_300px]">
      <p className="grid flex-[0_1_112px]! content-center justify-items-center gap-0.5 rounded-panel border border-border-strong bg-background p-3 text-center [&_strong]:font-mono [&_strong]:text-display [&_strong]:font-semibold [&_strong]:tabular-nums">
        <span className="text-small text-text-secondary">Classe de armadura</span>
        <strong>{character.ac}</strong>
        <span className="text-micro text-text-muted data-active:font-semibold data-active:text-accent-text" data-active={character.shield || undefined}>
          {character.shield ? 'Com escudo' : 'Sem escudo'}
        </span>
      </p>
      <HitPointsTracker hpCurrent={character.hpCurrent} hpTemp={character.hpTemp} hpMax={character.hp}
        editable={editable} pending={pending} onChange={(hitPoints) => onChange(hitPoints)} />
      <HitDiceTracker hitDie={character.hitDie} level={character.level} spent={character.hitDiceSpent}
        editable={editable} pending={pending} onChange={(hitDiceSpent) => onChange({ hitDiceSpent })} />
      <DeathSaves value={character.deathSaves} editable={editable} pending={pending}
        onChange={(deathSaves) => onChange({ deathSaves })} />
      <HeroicInspiration active={character.heroicInspiration} editable={editable} pending={pending}
        onChange={(heroicInspiration) => onChange({ heroicInspiration })} />
    </div>
  );
}

/**
 * Conditions and concentration, in and out of a fight: the sheet is where
 * they live. The owner marks them; the sheet sets no duration, and one a
 * fight is counting stays as it is. Everyone else only reads them.
 */
function SheetConditions({
  character,
  editable,
  pending,
  onChange,
}: {
  character: CharacterSheet;
  editable: boolean;
  pending: boolean;
  onChange: (state: CharacterStateInput) => void;
}) {
  const { conditions, concentrating } = character;
  if (!editable && conditions.length === 0 && !concentrating) return null;
  return (
    <section className={trackerPanel} aria-label="Condições e concentração">
      <p className={trackerLabel}>Condições e concentração</p>
      {editable ? (
        <>
          <ConditionPicker name={character.name} conditions={conditions} durations={false} pending={pending}
            onApply={(active) => onChange({ conditions: setCondition(conditions, active) })}
            onRemove={(condition) => onChange({ conditions: removeCondition(conditions, condition) })} />
          <div className="min-w-0 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
            <Button variant="ghost" aria-pressed={concentrating} disabled={pending} onClick={() => onChange({ concentrating: !concentrating })}>
              <Brain size={18} aria-hidden="true" />
              {concentrating ? 'Encerrar concentração' : 'Marcar concentração'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {concentrating && (
            <p className="m-0 inline-flex items-center gap-1 text-small text-foreground">
              <Brain size={16} aria-hidden="true" /> Concentrando
            </p>
          )}
          {conditions.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label={`Condições de ${character.name}`}>
              {conditions.map((active) => (
                <li key={active.condition} className="rounded-control border border-input bg-background px-2 py-0.5 text-small text-foreground">
                  {conditionLabel(active)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function CharacterTab({
  character,
  idPrefix,
  active,
  canRoll,
  rolling,
  roll,
}: {
  character: CharacterSheet;
  idPrefix: string;
  active: string;
  canRoll: boolean;
  rolling: boolean;
  roll: SheetRoll;
}) {
  const proficiency = proficiencyBonus(character.level) ?? 0;
  return (
    <SheetTabPanel idPrefix={idPrefix} id="character" active={active}>
      <DerivedStats proficiency={proficiency} initiative={initiative(character)} speed={character.speed}
        size={character.size} passivePerception={passivePerception(character)} disabled={rolling}
        onRollInitiative={canRoll ? () => roll({ kind: 'initiative' }) : undefined} />

      <h3 className="mt-2 font-display text-h2 font-semibold">Atributos, salvaguardas e perícias</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(240px,calc((100%_-_2*var(--spacing-3))/3))),1fr))] gap-3 max-[479px]:grid-cols-1">
        {ABILITIES.map((ability) => (
          <AbilityBlock
            key={ability}
            label={ABILITY_LABELS[ability]}
            abbreviation={ABILITY_ABBREVIATIONS[ability]}
            score={character.abilityScores[ability]}
            modifier={abilityModifier(character.abilityScores[ability]) ?? 0}
            saveBonus={saveBonus(character, ability)}
            saveProficient={character.saves.includes(ability)}
            skills={SKILLS_BY_ABILITY[ability].map((skill) => ({
              skill,
              label: SKILL_LABELS[skill],
              bonus: skillBonus(character, skill),
              proficiency: skillProficiency(character, skill),
            }))}
            disabled={rolling}
            onCheck={canRoll ? () => roll({ kind: 'check', ability }) : undefined}
            onSave={canRoll ? () => roll({ kind: 'save', ability }) : undefined}
            onSkill={canRoll ? (skill) => roll({ kind: 'skill', skill }) : undefined}
          />
        ))}
      </div>

      <h3 className="mt-2 font-display text-h2 font-semibold">Armas e truques de dano</h3>
      {character.attacks.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0">
          {contentKeys(character.attacks).map(({ item: attack, key }, index) => (
            <li key={key}>
              {/* An attack roll, its damage later from the feed; a save DC rolls only the damage. */}
              <AttackCard {...attack} disabled={rolling}
                onRoll={canRoll
                  ? () => roll({ kind: 'attack', attackIndex: index, ...(attack.kind === 'save' ? { mode: 'normal' as const } : {}) })
                  : undefined} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={sheetEmpty}>Nenhum ataque registrado.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <TraitList title="Características de classe" items={character.features} emptyText="Nenhuma característica registrada." />
        <TraitList title="Traços de espécie" items={character.speciesTraits} emptyText="Nenhum traço registrado." />
        <TraitList title="Talentos" items={character.feats} emptyText="Nenhum talento registrado." />
      </div>

      <h3 className="mt-2 font-display text-h2 font-semibold">Treinamento em equipamentos e proficiências</h3>
      <EquipmentTraining armorTraining={character.armorTraining} weapons={character.weaponProficiencies}
        tools={character.toolProficiencies} />
    </SheetTabPanel>
  );
}

function SpellsTab({
  character,
  idPrefix,
  active,
  canRoll,
  rolling,
  editable,
  pending,
  onChange,
  roll,
}: {
  character: CharacterSheet;
  idPrefix: string;
  active: string;
  canRoll: boolean;
  rolling: boolean;
  editable: boolean;
  pending: boolean;
  onChange: (state: CharacterStateInput) => void;
  roll: SheetRoll;
}) {
  const saveDc = spellSaveDc(character);
  const spellAttack = spellAttackBonus(character);
  return (
    <SheetTabPanel idPrefix={idPrefix} id="spells" active={active}>
      {character.spellcastingAbility && saveDc !== null && spellAttack !== null ? (
        <SpellcastingHeader abilityLabel={ABILITY_LABELS[character.spellcastingAbility]}
          modifier={abilityModifier(character.abilityScores[character.spellcastingAbility]) ?? 0}
          saveDc={saveDc} attackBonus={spellAttack} disabled={rolling}
          onRollAttack={canRoll ? () => roll({ kind: 'spellAttack' }) : undefined} />
      ) : (
        <p className={sheetEmpty}>Sem atributo de conjuração: este personagem não conjura magias.</p>
      )}
      <h3 className="mt-2 font-display text-h2 font-semibold">Espaços de magia</h3>
      <SpellSlots slots={character.spellSlots} editable={editable} pending={pending}
        onChange={(spellSlotsSpent) => onChange({ spellSlotsSpent })} />
      <h3 className="mt-2 font-display text-h2 font-semibold">Truques e magias preparadas</h3>
      <SpellList spells={character.spells} />
    </SheetTabPanel>
  );
}

function InventoryTab({
  character,
  idPrefix,
  active,
  editable,
  pending,
  onChange,
}: {
  character: CharacterSheet;
  idPrefix: string;
  active: string;
  editable: boolean;
  pending: boolean;
  onChange: (state: CharacterStateInput) => void;
}) {
  return (
    <SheetTabPanel idPrefix={idPrefix} id="inventory" active={active}>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3 [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-small [&_dt]:text-text-secondary">
        <div>
          <dt>Alinhamento</dt>
          <dd>{character.alignment || <span className={sheetEmpty}>Não informado</span>}</dd>
        </div>
        <div>
          <dt>Idiomas</dt>
          <dd>{character.languages || <span className={sheetEmpty}>Não informados</span>}</dd>
        </div>
      </dl>
      <section className="grid min-w-0 gap-2">
        <h3 className="mt-2 font-display text-h2 font-semibold">Aparência</h3>
        {character.appearance
          ? <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{character.appearance}</p>
          : <p className={sheetEmpty}>Sem descrição de aparência.</p>}
      </section>
      <section className="grid min-w-0 gap-2">
        <h3 className="mt-2 font-display text-h2 font-semibold">História e personalidade</h3>
        {character.description
          ? <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{character.description}</p>
          : <p className={sheetEmpty}>Sem história registrada.</p>}
      </section>
      <section className="grid min-w-0 gap-2">
        <h3 className="mt-2 font-display text-h2 font-semibold">Equipamento</h3>
        {character.equipment
          ? <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{character.equipment}</p>
          : <p className={sheetEmpty}>Nenhum equipamento registrado.</p>}
      </section>
      <section className="grid min-w-0 gap-2">
        <h3 className="mt-2 font-display text-h2 font-semibold">Itens mágicos sintonizados</h3>
        <AttunedItems items={character.attunedItems} />
      </section>
      <section className="grid min-w-0 gap-2">
        <h3 className="mt-2 font-display text-h2 font-semibold">Moedas</h3>
        {/* Remounted when the saved coins change, which resets the draft. */}
        <CoinPurse key={JSON.stringify(character.coins)} coins={character.coins} editable={editable}
          pending={pending} onSave={(coins) => onChange({ coins })} />
      </section>
    </SheetTabPanel>
  );
}

/** The last roll of any control of the sheet, pinned under it. */
function RollResult({
  character,
  rolling,
  rollError,
  lastRoll,
}: {
  character: CharacterSheet;
  rolling: boolean;
  rollError: string | null;
  lastRoll: RollPayload | null;
}) {
  return (
    <div className="sticky bottom-[calc(var(--qf-dialog-pad)*-1)] z-1 -mx-(--qf-dialog-pad) mt-4 -mb-(--qf-dialog-pad) grid gap-2 border-t border-border bg-popover px-(--qf-dialog-pad) py-4" aria-live="polite">
      {rolling && <Skeleton shape="panel" aria-label="Rolando…" />}

      {rollError && !rolling && (
        <p role="alert" className="text-small text-danger-text">
          {rollError}
        </p>
      )}

      {lastRoll && !rolling && !rollError && (
        <DiceResult
          label={`${rollActionLabel(lastRoll)} de ${character.name}`}
          total={lastRoll.total}
          decomposition={decompose(lastRoll)}
          dice={lastRoll.dice}
          mode={lastRoll.mode}
          natural={lastRoll.natural}
        />
      )}
    </div>
  );
}

function DeleteConfirmation({
  character,
  deleting,
  onCancel,
  onConfirm,
}: {
  character: CharacterSheet;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-panel border border-danger-text bg-card p-4" role="group" aria-label={`Confirmar exclusão de ${character.name}`}>
      <p className="m-0 flex items-center gap-2 font-semibold text-danger-text">
        <Warning size={18} weight="fill" aria-hidden="true" />
        Excluir {character.name}?
      </p>
      <p className="m-0 text-small text-text-secondary">
        A ficha sai da mesa para todo mundo e não há como recuperá-la. As rolagens já
        registradas permanecem no histórico da sessão.
      </p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Manter ficha
        </Button>
        <Button variant="danger" loading={deleting} onClick={onConfirm}>
          <Trash size={18} aria-hidden="true" />
          Excluir personagem
        </Button>
      </div>
    </div>
  );
}

/**
 * The sheet as the table reads it, organized like the official D&D 2024
 * sheet. Data, mutations and the dialog shell stay outside, so every state
 * below is reachable from a story.
 */
export function CharacterSheetView({
  character,
  isOwner,
  canDelete,
  rolling = false,
  rollError = null,
  lastRoll = null,
  stateSaving = false,
  stateError = null,
  confirmingDelete = false,
  deleting = false,
  deleteError = null,
  onRoll,
  onStateChange,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  character: CharacterSheet;
  isOwner: boolean;
  canDelete: boolean;
  rolling?: boolean;
  rollError?: string | null;
  lastRoll?: RollPayload | null;
  stateSaving?: boolean;
  stateError?: string | null;
  confirmingDelete?: boolean;
  deleting?: boolean;
  deleteError?: string | null;
  onRoll: (request: LinkedRollRequest) => void;
  /** Absent means read-only state, as for anyone but the owner. */
  onStateChange?: (state: CharacterStateInput) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  // The API accepts an edit, a linked roll and a state change only from the
  // owner, so the sheet never offers them to anyone else.
  const canRoll = isOwner;
  const canEdit = isOwner;
  const canChangeState = isOwner && Boolean(onStateChange);
  const change = (state: CharacterStateInput) => onStateChange?.(state);

  const tabsId = useId();
  const [tab, setTab] = useState<string>('character');

  // One mode choice for every linked roll of the sheet; always a single d20,
  // so advantage and disadvantage always apply.
  const [mode, setMode] = useState<RollMode>('normal');
  const roll: SheetRoll = (request) => onRoll({ mode, ...request });

  const tabProps = { character, idPrefix: tabsId, canRoll, rolling, roll };
  const liveTabProps = { ...tabProps, editable: canChangeState, pending: stateSaving, onChange: change };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 max-[479px]:p-3">
      <Surface variant="sheet" className="grid grid-cols-[minmax(0,1fr)] gap-4 max-[479px]:p-3">
        <SheetHead character={character} isOwner={isOwner} />

        <CombatTrackers character={character} editable={canChangeState} pending={stateSaving} onChange={change} />
        <SheetConditions character={character} editable={canChangeState} pending={stateSaving} onChange={change} />

        {stateError && (
          <p role="alert" className="text-small text-danger-text">
            {stateError}
          </p>
        )}

        {!isOwner && (
          <p className="m-0 rounded-control border border-dashed border-input bg-card px-3 py-2 text-small text-text-secondary">
            Consulta: só {character.ownerName} edita e rola por esta ficha.
          </p>
        )}

        {canRoll && (
          <div className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-card p-3">
            <span className="text-small text-text-secondary">Modo da rolagem</span>
            <RollModeControl value={mode} onChange={setMode} disabled={rolling} />
          </div>
        )}

        <SheetTabs tabs={TABS} active={tab} onChange={setTab} idPrefix={tabsId} label={`Seções da ficha de ${character.name}`} />

        <CharacterTab {...tabProps} active={tab} />
        <SpellsTab {...liveTabProps} active={tab} />
        <InventoryTab character={character} idPrefix={tabsId} active={tab}
          editable={canChangeState} pending={stateSaving} onChange={change} />

        {deleteError && (
          <p role="alert" className="text-small text-danger-text">
            {deleteError}
          </p>
        )}

        {(canEdit || canDelete) && !confirmingDelete && (
          <div className={dialogActions}>
            {canEdit && (
              <Button variant="secondary" onClick={onEdit}>
                <PencilSimple size={18} aria-hidden="true" />
                Editar
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" onClick={onAskDelete}>
                <Trash size={18} aria-hidden="true" />
                Excluir
              </Button>
            )}
          </div>
        )}

        {confirmingDelete && (
          <DeleteConfirmation character={character} deleting={deleting}
            onCancel={onCancelDelete} onConfirm={onConfirmDelete} />
        )}
      </Surface>

      {/* The result stays pinned to the bottom of the sheet: whichever control
          fired the roll, the answer lands in the same place. */}
      {(rolling || rollError || lastRoll) && (
        <RollResult character={character} rolling={rolling} rollError={rollError} lastRoll={lastRoll} />
      )}
    </div>
  );
}
