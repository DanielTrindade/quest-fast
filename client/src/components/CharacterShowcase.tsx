import type { ReactNode } from 'react';
import { FileText } from '@phosphor-icons/react';
import { ABILITIES, abilityModifier, initiative, passivePerception, type Ability, type MyCharacter } from '@quest-fast/shared';
import { ABILITY_ABBREVIATIONS, ABILITY_LABELS, signed } from '../lib/5e';
import { formatSpeed } from '../lib/sheet-labels';
import { CharacterPortrait } from './CharacterPortrait';
import { ActiveBadge } from './HeroCard';
import { hpLabel } from '../lib/hit-points';
import { HpMeter } from './HpMeter';
import { Button } from './ui/button';

// Physical abilities down the first column, mental down the second.
const BAR_ORDER: Ability[] = ['strength', 'intelligence', 'dexterity', 'wisdom', 'constitution', 'charisma'];
/** Bars read against the usual ceiling of a score; anything above fills them. */
const SCORE_CEILING = 20;

function AbilityBars({ scores }: { scores: MyCharacter['abilityScores'] }) {
  const top = Math.max(...ABILITIES.map((ability) => scores[ability]));
  return (
    <dl data-slot="ability-bars" className="m-0 grid grid-cols-2 gap-x-5 gap-y-2 @max-[420px]:grid-cols-1">
      {BAR_ORDER.map((ability) => {
        const score = scores[ability];
        const modifier = abilityModifier(score);
        return (
          <div key={ability} data-top={score === top || undefined}
            className="group grid grid-cols-[34px_minmax(0,1fr)_56px] items-center gap-2.5 font-mono text-small">
            <dt className="tracking-[0.06em] text-text-muted group-data-top:text-foreground">
              <abbr title={ABILITY_LABELS[ability]}>{ABILITY_ABBREVIATIONS[ability]}</abbr>
            </dt>
            <dd className="contents">
              <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-[2px] bg-surface-secret shadow-[inset_0_0_0_1px_var(--color-border-subtle)] group-data-top:shadow-[inset_0_0_0_1px_var(--color-accent-text)]">
                <span className="h-full bg-linear-to-r from-accent-text/55 to-accent-text"
                  style={{ width: `${Math.min(100, (score / SCORE_CEILING) * 100)}%` }} />
              </span>
              <span className="text-end tabular-nums">
                {score} <span className="text-text-muted">{modifier === undefined ? '' : signed(modifier)}</span>
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * The highlight of the account gallery: the portrait fading into the panel,
 * the name large, the defence band and the six abilities as status bars.
 * Reading only; `actions` holds what the screen allows next to the campaign.
 */
export function CharacterShowcase({ character, onOpen, actions }: {
  character: MyCharacter; onOpen: () => void; actions?: ReactNode;
}) {
  const { name, hp, hpCurrent, hpTemp } = character;
  const kicker = [character.class, character.subclass].filter(Boolean).join(' · ');
  const lore = [character.race, character.background, character.alignment].filter(Boolean).join(' · ');

  return (
    <section data-slot="character-showcase" aria-label={`Destaque: ${name}`} className="@container min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(180px,0.8fr)_minmax(0,1.4fr)] overflow-hidden rounded-panel border border-border-strong bg-card shadow-[inset_0_0_0_3px_var(--color-surface-raised),inset_0_0_0_4px_var(--color-border-subtle)] @max-[599px]:grid-cols-1">
        <div className="relative m-1 mr-0 min-h-64 overflow-hidden rounded-l-[7px] @max-[599px]:mr-1 @max-[599px]:aspect-[4/3] @max-[599px]:min-h-0 @max-[599px]:rounded-r-[7px]">
          <CharacterPortrait name={name} src={character.avatarUrl} className="absolute inset-0"
            initialsClassName="text-[72px] leading-none" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[38%] bg-linear-to-r from-transparent to-card @max-[599px]:hidden" />
          <span className="absolute bottom-3 left-3 grid justify-items-center rounded-control border border-border-strong bg-surface-secret px-2.5 pt-1.5 pb-1 edge-raised">
            <small className="font-mono text-micro tracking-[0.12em] text-text-muted">NÍVEL</small>
            <b className="font-mono text-h1 font-bold leading-6">{character.level}</b>
          </span>
        </div>

        <div className="grid min-w-0 content-start gap-4 px-6 pt-5 pb-5 @max-[599px]:px-4">
          <div className="grid gap-1.5">
            {kicker && <p className="m-0 font-mono text-micro tracking-[0.1em] text-accent-text uppercase">{kicker}</p>}
            <h2 className="m-0 font-display text-display font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{name}</h2>
            {lore && <p className="m-0 text-small text-text-secondary">{lore}</p>}
          </div>

          <dl className="m-0 grid grid-cols-4 border-y border-border py-2.5 @max-[420px]:grid-cols-2 @max-[420px]:gap-y-2 [&>div]:grid [&>div]:min-w-0 [&>div]:content-start [&>div]:gap-0.5 [&>div]:px-2.5 [&>div:first-child]:pl-0 [&>div+div]:border-l [&>div+div]:border-border [&_dd]:m-0 [&_dd]:font-mono [&_dd]:text-h1 [&_dd]:font-semibold [&_dd]:tabular-nums [&_dt]:font-mono [&_dt]:text-micro [&_dt]:tracking-[0.08em] [&_dt]:text-text-muted [&_dt]:uppercase">
            <div><dt>CA</dt><dd>{character.ac}</dd></div>
            <div>
              <dt>PV</dt>
              <dd>
                <span aria-hidden="true">{hpCurrent}<span className="text-small font-medium text-text-muted">/{hp}</span></span>
                <span className="sr-only">{hpLabel(hpCurrent, hp, hpTemp)}</span>
              </dd>
              <HpMeter current={hpCurrent} max={hp} temp={hpTemp} className="mt-1 h-1" />
            </div>
            <div><dt><abbr title="Iniciativa">Inic.</abbr></dt><dd>{signed(initiative(character))}</dd></div>
            <div><dt><abbr title="Deslocamento">Desl.</abbr></dt><dd>{formatSpeed(character.speed)}</dd></div>
          </dl>

          <AbilityBars scores={character.abilityScores} />

          <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-control border border-border bg-surface-secret px-3 py-2.5">
            <span className="grid min-w-0 flex-1 gap-1">
              <b className="text-small font-semibold [overflow-wrap:anywhere]">{character.campaignName}</b>
              <ActiveBadge active={character.active} />
            </span>
            {actions}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-micro text-text-muted">Percepção passiva {passivePerception(character)}</span>
            <Button variant="secondary" size="sm" onClick={onOpen}>
              <FileText size={16} aria-hidden="true" /> Abrir ficha
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
