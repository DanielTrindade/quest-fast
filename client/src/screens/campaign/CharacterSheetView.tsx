import { useId, useState } from 'react';
import { PencilSimple, Trash, Warning } from '@phosphor-icons/react';
import {
  ABILITIES,
  SKILLS,
  SKILL_ABILITIES,
  abilityModifier,
  initiative,
  passivePerception,
  proficiencyBonus,
  saveBonus,
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
import { contentKeys } from '../../lib/content-keys';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, SKILL_LABELS } from '../../lib/5e';

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

/** A linked roll without its mode: the sheet owns one mode for all of them. */
type SheetRoll = (request: Omit<LinkedRollRequest, 'mode'>) => void;

function SheetHead({ character, isOwner }: { character: CharacterSheet; isOwner: boolean }) {
  return (
    <div className="sheet-head">
      <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="lg" />
      <div className="sheet-head__meta">
        <p className="sheet-head__owner">{isOwner ? 'Seu personagem' : `Ficha de ${character.ownerName}`}</p>
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
    <div className="sheet-combat">
      <p className="sheet-ac">
        <span className="sheet-ac__label">Classe de armadura</span>
        <strong>{character.ac}</strong>
        <span className="sheet-ac__shield" data-active={character.shield || undefined}>
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

      <h3 className="sheet-subheading">Atributos, salvaguardas e perícias</h3>
      <div className="sheet-abilities">
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

      <h3 className="sheet-subheading">Armas e truques de dano</h3>
      {character.attacks.length > 0 ? (
        <ul className="sheet-attacks">
          {contentKeys(character.attacks).map(({ item: attack, key }, index) => (
            <li key={key}>
              <AttackCard name={attack.name} bonus={attack.bonus} damage={attack.damage}
                damageType={attack.damageType} notes={attack.notes} disabled={rolling}
                onRoll={canRoll ? () => roll({ kind: 'attack', attackIndex: index }) : undefined} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="qf-sheet-empty">Nenhum ataque registrado.</p>
      )}

      <div className="sheet-traits">
        <TraitList title="Características de classe" items={character.features} emptyText="Nenhuma característica registrada." />
        <TraitList title="Traços de espécie" items={character.speciesTraits} emptyText="Nenhum traço registrado." />
        <TraitList title="Talentos" items={character.feats} emptyText="Nenhum talento registrado." />
      </div>

      <h3 className="sheet-subheading">Treinamento em equipamentos e proficiências</h3>
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
        <p className="qf-sheet-empty">Sem atributo de conjuração: este personagem não conjura magias.</p>
      )}
      <h3 className="sheet-subheading">Espaços de magia</h3>
      <SpellSlots slots={character.spellSlots} editable={editable} pending={pending}
        onChange={(spellSlotsSpent) => onChange({ spellSlotsSpent })} />
      <h3 className="sheet-subheading">Truques e magias preparadas</h3>
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
      <dl className="sheet-facts">
        <div>
          <dt>Alinhamento</dt>
          <dd>{character.alignment || <span className="qf-sheet-empty">Não informado</span>}</dd>
        </div>
        <div>
          <dt>Idiomas</dt>
          <dd>{character.languages || <span className="qf-sheet-empty">Não informados</span>}</dd>
        </div>
      </dl>
      <section className="sheet-block">
        <h3 className="sheet-subheading">Aparência</h3>
        {character.appearance
          ? <p className="sheet-text">{character.appearance}</p>
          : <p className="qf-sheet-empty">Sem descrição de aparência.</p>}
      </section>
      <section className="sheet-block">
        <h3 className="sheet-subheading">História e personalidade</h3>
        {character.description
          ? <p className="sheet-text">{character.description}</p>
          : <p className="qf-sheet-empty">Sem história registrada.</p>}
      </section>
      <section className="sheet-block">
        <h3 className="sheet-subheading">Equipamento</h3>
        {character.equipment
          ? <p className="sheet-text">{character.equipment}</p>
          : <p className="qf-sheet-empty">Nenhum equipamento registrado.</p>}
      </section>
      <section className="sheet-block">
        <h3 className="sheet-subheading">Itens mágicos sintonizados</h3>
        <AttunedItems items={character.attunedItems} />
      </section>
      <section className="sheet-block">
        <h3 className="sheet-subheading">Moedas</h3>
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
    <div className="sheet-roll" aria-live="polite">
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
    <div className="sheet-confirm" role="group" aria-label={`Confirmar exclusão de ${character.name}`}>
      <p className="sheet-confirm__question">
        <Warning size={18} weight="fill" aria-hidden="true" />
        Excluir {character.name}?
      </p>
      <p className="sheet-confirm__detail">
        A ficha sai da mesa para todo mundo e não há como recuperá-la. As rolagens já
        registradas permanecem no histórico da sessão.
      </p>
      <div className="qf-dialog__actions">
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
  const roll: SheetRoll = (request) => onRoll({ ...request, mode });

  const tabProps = { character, idPrefix: tabsId, canRoll, rolling, roll };
  const liveTabProps = { ...tabProps, editable: canChangeState, pending: stateSaving, onChange: change };

  return (
    <div className="sheet">
      <Surface variant="sheet" className="sheet">
        <SheetHead character={character} isOwner={isOwner} />

        <CombatTrackers character={character} editable={canChangeState} pending={stateSaving} onChange={change} />

        {stateError && (
          <p role="alert" className="text-small text-danger-text">
            {stateError}
          </p>
        )}

        {!isOwner && (
          <p className="sheet-readonly">
            Consulta: só {character.ownerName} edita e rola por esta ficha.
          </p>
        )}

        {canRoll && (
          <div className="sheet-mode">
            <span className="sheet-mode__label">Modo da rolagem</span>
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
          <div className="qf-dialog__actions">
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
