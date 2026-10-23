import type { ReactNode } from 'react';
import { ABILITIES, abilityModifier, type Statblock } from '@quest-fast/shared';
import { AttackCard } from './AttackCard';
import { Surface } from './Surface';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, signed } from '../lib/5e';
import { contentKeys } from '../lib/content-keys';
import { SIZE_LABELS } from '../lib/sheet-labels';

type StatblockView = Omit<Statblock, 'id' | 'campaignId' | 'createdAt' | 'updatedAt'>;

function TextSection({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  if (!text.trim() && !children) return null;
  return (
    <section className="qf-statblock__section">
      <h4>{title}</h4>
      {children}
      {text.trim() && <p className="qf-statblock__text">{text.trim()}</p>}
    </section>
  );
}

/**
 * A bestiary entry in the order of the 2024 stat block: who it is, how hard it
 * is to hit and to kill, its abilities, then what it does. Read-only; the
 * consumer passes the actions (edit, delete) and decides who sees them.
 */
export function StatblockCard({ statblock, actions }: { statblock: StatblockView; actions?: ReactNode }) {
  const { name, size, creatureType, challengeRating, ac, hpAverage, hpFormula, speed, abilityScores } = statblock;
  const initiative = (abilityModifier(abilityScores.dexterity) ?? 0) + statblock.initiativeBonus;
  const kind = [SIZE_LABELS[size], creatureType.trim()].filter(Boolean).join(', ');

  return (
    <Surface variant="sheet" className="qf-statblock">
      <header className="qf-statblock__head">
        <div className="qf-statblock__identity">
          <h3 className="qf-statblock__name">{name}</h3>
          <p className="qf-statblock__kind">
            {kind}
            {challengeRating && <span className="qf-statblock__cr">ND {challengeRating}</span>}
          </p>
        </div>
        {actions && <div className="qf-statblock__actions">{actions}</div>}
      </header>

      <dl className="qf-statblock__defenses">
        <div>
          <dt>CA</dt>
          <dd>{ac}</dd>
        </div>
        <div>
          <dt>PV</dt>
          <dd>
            {hpAverage}
            {hpFormula && <span className="qf-statblock__aside">({hpFormula})</span>}
          </dd>
        </div>
        <div>
          <dt>Iniciativa</dt>
          <dd>
            {signed(initiative)}
            <span className="qf-statblock__aside"><span className="sr-only">passiva </span>({10 + initiative})</span>
          </dd>
        </div>
        {speed.trim() && (
          <div className="qf-statblock__speed">
            <dt>Deslocamento</dt>
            <dd>{speed.trim()}</dd>
          </div>
        )}
      </dl>

      <dl className="qf-statblock__abilities">
        {ABILITIES.map((ability) => {
          const score = abilityScores[ability];
          const modifier = abilityModifier(score) ?? 0;
          return (
            <div key={ability}>
              <dt>
                <abbr title={ABILITY_LABELS[ability]}>{ABILITY_ABBREVIATIONS[ability]}</abbr>
              </dt>
              <dd>
                <span className="qf-statblock__score">{score}</span>
                <span className="qf-statblock__modifier">
                  <span className="sr-only">modificador </span>{signed(modifier)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <TextSection title="Traços" text={statblock.traits} />
      <TextSection title="Ações" text={statblock.actions}>
        {statblock.attacks.length > 0 && (
          <ul className="qf-statblock__attacks">
            {contentKeys(statblock.attacks).map(({ item: attack, key }) => (
              <li key={key}>
                <AttackCard {...attack} />
              </li>
            ))}
          </ul>
        )}
      </TextSection>
      <TextSection title="Reações" text={statblock.reactions} />
    </Surface>
  );
}
