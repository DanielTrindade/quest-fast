import type { ReactNode } from 'react';
import { ABILITIES, abilityModifier, type Statblock } from '@quest-fast/shared';
import { AttackCard } from './AttackCard';
import { Surface } from './Surface';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, signed } from '../lib/5e';
import { contentKeys } from '../lib/content-keys';
import { SIZE_LABELS } from '../lib/sheet-labels';
import { Badge } from './ui/badge';

const aside = 'font-sans text-small font-normal text-text-muted';

type StatblockView = Omit<Statblock, 'id' | 'campaignId' | 'createdAt' | 'updatedAt'>;

function TextSection({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  if (!text.trim() && !children) return null;
  return (
    <section className="grid gap-2 border-t border-border pt-3">
      <h4 className="font-display text-h2 font-semibold">{title}</h4>
      {children}
      {text.trim() && <p className="max-w-[72ch] whitespace-pre-line text-text-secondary [overflow-wrap:anywhere]">{text.trim()}</p>}
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
    <Surface variant="sheet" className="@container grid min-w-0 gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_12rem]">
          <h3 className="font-display text-h1 font-semibold tracking-tight [overflow-wrap:anywhere]">{name}</h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-text-secondary italic [overflow-wrap:anywhere]">
            {kind}
            {challengeRating && <Badge variant="outline" className="font-mono not-italic">ND {challengeRating}</Badge>}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>

      <dl className="m-0 grid grid-cols-3 border-y border-border-strong [&_dd]:mt-1 [&_dd]:flex [&_dd]:flex-wrap [&_dd]:items-baseline [&_dd]:gap-x-2 [&_dd]:font-mono [&_dd]:text-h1 [&_dd]:font-medium [&_dd]:tabular-nums @max-[360px]:[&_dd]:text-h2 [&_dt]:text-small [&_dt]:text-text-secondary [&>div]:min-w-0 [&>div]:py-3 [&>div]:pr-3 [&>div+div]:border-l [&>div+div]:border-border [&>div+div]:pl-3">
        <div>
          <dt>CA</dt>
          <dd>{ac}</dd>
        </div>
        <div>
          <dt>PV</dt>
          <dd>
            {hpAverage}
            {hpFormula && <span className={aside}>({hpFormula})</span>}
          </dd>
        </div>
        <div>
          <dt>Iniciativa</dt>
          <dd>
            {signed(initiative)}
            <span className={aside}><span className="sr-only">passiva </span>({10 + initiative})</span>
          </dd>
        </div>
        {speed.trim() && (
          <div className="col-span-full border-t border-border border-l-0! pl-0!">
            <dt>Deslocamento</dt>
            <dd className="font-sans! text-body! font-normal!">{speed.trim()}</dd>
          </div>
        )}
      </dl>

      <dl className="m-0 grid grid-cols-6 gap-2 text-center @max-[360px]:grid-cols-3">
        {ABILITIES.map((ability) => {
          const score = abilityScores[ability];
          const modifier = abilityModifier(score) ?? 0;
          return (
            <div key={ability} className="min-w-0 rounded-control border border-border bg-background px-1 py-2">
              <dt className="text-micro text-text-secondary">
                <abbr title={ABILITY_LABELS[ability]} className="no-underline">{ABILITY_ABBREVIATIONS[ability]}</abbr>
              </dt>
              <dd className="mt-1 grid font-mono tabular-nums">
                <span className="font-semibold">{score}</span>
                <span className="text-small text-text-secondary">
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
          <ul className="m-0 grid list-none gap-2 p-0 *:min-w-0">
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
