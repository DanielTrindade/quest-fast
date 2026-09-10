import { PencilSimple, Trash, Warning } from '@phosphor-icons/react';
import { abilityModifier, proficiencyBonus, type Ability, type CharacterSheet, type LinkedRollRequest, type RollPayload } from '@quest-fast/shared';
import { Avatar } from '../../components/Avatar';
import { AbilityCard } from '../../components/AbilityCard';
import { Button } from '../../components/Button';
import { DiceResult } from '../../components/DiceResult';
import { Skeleton } from '../../components/Skeleton';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, SKILL_LABELS, signed } from '../../lib/5e';

function rollActionLabel(payload: RollPayload): string {
  if (payload.rollKind === 'attack') return `Ataque (${payload.attackName})`;
  if (payload.rollKind === 'check') return `Teste de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'save') return `Resistência de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  return 'Rolagem';
}

function AbilityRow({
  ability,
  score,
  proficient,
  level,
  canRoll,
  disabled,
  onRoll,
}: {
  ability: Ability;
  score: number;
  proficient: boolean;
  level: number;
  canRoll: boolean;
  disabled: boolean;
  onRoll: (request: LinkedRollRequest) => void;
}) {
  const modifier = abilityModifier(score) ?? 0;
  const saveBonus = proficient ? modifier + (proficiencyBonus(level) ?? 0) : modifier;
  return (
    <AbilityCard label={ABILITY_LABELS[ability]} abbreviation={ABILITY_ABBREVIATIONS[ability]}
      score={score} modifier={modifier} saveBonus={saveBonus} proficient={proficient} disabled={disabled}
      onCheck={canRoll ? () => onRoll({ kind: 'check', ability }) : undefined}
      onSave={canRoll ? () => onRoll({ kind: 'save', ability }) : undefined} />
  );
}

function decompose(payload: RollPayload) {
  const kept = payload.dice.filter((die) => !die.discarded).map((die) => `${die.value}`).join(' + ');
  if (payload.modifier === 0) return kept;
  return `${kept} ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
}

/**
 * The sheet as the table reads it. Data, mutations and the dialog shell stay
 * outside, so every state below is reachable from a story.
 */
export function CharacterSheetView({
  character,
  isOwner,
  canDelete,
  rolling = false,
  rollError = null,
  lastRoll = null,
  confirmingDelete = false,
  deleting = false,
  deleteError = null,
  onRoll,
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
  confirmingDelete?: boolean;
  deleting?: boolean;
  deleteError?: string | null;
  onRoll: (request: LinkedRollRequest) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  // The API accepts an edit and a linked roll only from the owner, so the sheet
  // never offers either to anyone else.
  const canRoll = isOwner;
  const canEdit = isOwner;

  return (
    <div className="sheet">
      <div className="sheet-head">
        <Avatar name={character.name} src={character.avatarUrl ?? undefined} variant="character" size="lg" />
        <div className="sheet-head__meta">
          <p className="sheet-head__owner">
            {isOwner ? 'Seu personagem' : `Ficha de ${character.ownerName}`}
          </p>
          <p className="sheet-head__stats">
            <span className="sheet-stat">
              <span>HP</span>
              <b>{character.hp}</b>
            </span>
            <span className="sheet-stat">
              <span>CA</span>
              <b>{character.ac}</b>
            </span>
          </p>
        </div>
      </div>

      {!isOwner && (
        <p className="sheet-readonly">
          Consulta: só {character.ownerName} edita e rola por esta ficha.
        </p>
      )}

      <h3 className="sheet-subheading">Atributos</h3>
      <div className="sheet-abilities">
        {(Object.keys(character.abilityScores) as Ability[]).map((ability) => (
          <AbilityRow
            key={ability}
            ability={ability}
            score={character.abilityScores[ability]}
            proficient={character.saves.includes(ability)}
            level={character.level}
            canRoll={canRoll}
            disabled={rolling}
            onRoll={onRoll}
          />
        ))}
      </div>

      {character.attacks.length > 0 && (
        <>
          <h3 className="sheet-subheading">Ataques</h3>
          <ul className="sheet-attacks">
            {character.attacks.map((attack, index) => (
              <li key={`${attack.name}-${index}`}>
                <span className="sheet-attacks__name">{attack.name}</span>
                <span className="sheet-attacks__bonus">
                  <span>Acerto</span>
                  <b>{signed(attack.bonus)}</b>
                </span>
                <span className="sheet-attacks__damage">
                  <span>Dano</span>
                  <b>{attack.damage}</b>
                </span>
                {canRoll && (
                  <Button
                    variant="secondary"
                    disabled={rolling}
                    aria-label={`Rolar ataque de ${attack.name}`}
                    onClick={() => onRoll({ kind: 'attack', attackIndex: index })}
                  >
                    Rolar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {character.skills.length > 0 && (
        <>
          <h3 className="sheet-subheading">Perícias</h3>
          <ul className="sheet-chips" aria-label="Perícias treinadas">
            {character.skills.map((skill) => (
              <li key={skill}>{SKILL_LABELS[skill]}</li>
            ))}
          </ul>
        </>
      )}

      {character.features.length > 0 && (
        <>
          <h3 className="sheet-subheading">Características</h3>
          <ul className="sheet-features">
            {character.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </>
      )}

      {character.description && (
        <>
          <h3 className="sheet-subheading">Descrição</h3>
          <p className="sheet-description">{character.description}</p>
        </>
      )}

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
            <Button variant="secondary" onClick={onCancelDelete}>
              Manter ficha
            </Button>
            <Button variant="danger" loading={deleting} onClick={onConfirmDelete}>
              <Trash size={18} aria-hidden="true" />
              Excluir personagem
            </Button>
          </div>
        </div>
      )}

      {/* The result stays pinned to the bottom of the sheet: whichever control
          fired the roll, the answer lands in the same place. */}
      {(rolling || rollError || lastRoll) && (
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
      )}
    </div>
  );
}
