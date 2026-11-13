import type { ReactNode } from 'react';
import { FileText } from '@phosphor-icons/react';
import { ABILITIES, abilityModifier, initiative, passivePerception, type MyCharacter } from '@quest-fast/shared';
import { ABILITY_LABELS, signed } from '../lib/5e';
import { classLine } from '../lib/character-lines';
import { usePortrait } from '../hooks/usePortrait';
import { hpLabel, isDown } from '../lib/hit-points';
import { formatSpeed } from '../lib/sheet-labels';
import { cn } from '../lib/utils';
import { ArmorShield } from './ArmorShield';
import { Avatar } from './Avatar';
import { ActiveBadge } from './HeroCard';
import { HpMeter } from './HpMeter';
import { Button } from './ui/button';

/** The six abilities as the printed sheet draws them: modifier large, score in the oval. */
export function AbilityRow({ scores, className }: { scores: MyCharacter['abilityScores']; className?: string }) {
  return (
    <dl data-slot="ability-row" className={cn('m-0 grid grid-cols-6 gap-2 @max-[540px]:grid-cols-3', className)}>
      {ABILITIES.map((ability) => {
        const modifier = abilityModifier(scores[ability]);
        return (
          <div key={ability} className="grid min-w-0 justify-items-center gap-1 rounded-control border border-border-strong bg-background px-1 pt-2 pb-1.5 text-center">
            <dt className="max-w-full truncate text-micro text-text-secondary">{ABILITY_LABELS[ability]}</dt>
            <dd className="m-0 grid justify-items-center gap-1">
              <b className="font-mono text-h1 leading-none font-medium tabular-nums">
                <span className="sr-only">Modificador </span>{modifier === undefined ? '—' : signed(modifier)}
              </b>
              <span className="min-w-9 rounded-full border border-border bg-card px-2 font-mono text-small tabular-nums text-text-secondary">
                <span className="sr-only">Valor </span>{scores[ability]}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// Value on top, label under it, as the boxes of the printed sheet.
const fact = 'grid min-w-0 content-start gap-0.5 [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere] [&_dt]:order-last [&_dt]:text-micro [&_dt]:text-text-muted';

/**
 * The highlight of the account gallery, laid out like the head of the printed
 * sheet: who the character is, the armour class in its shield, the numbers
 * asked most at the table and the six abilities. Reading only; `actions`
 * holds what the screen allows next to the campaign.
 */
export function CharacterShowcase({ character, onOpen, actions }: {
  character: MyCharacter; onOpen: () => void; actions?: ReactNode;
}) {
  const { name, hp, hpCurrent, hpTemp } = character;
  const portrait = usePortrait(character.avatarUrl);
  const avatarUrl = portrait.src;
  const down = isDown(hpCurrent);
  const facts = [
    ['Subclasse', character.subclass],
    ['Espécie', character.race],
    ['Antecedente', character.background],
    ['Tendência', character.alignment],
  ].filter(([, value]) => value);

  return (
    <section data-slot="character-showcase" aria-label={`Destaque: ${name}`} className="@container min-w-0">
      <div className={cn(
        'grid min-w-0 overflow-hidden rounded-panel border border-border-strong bg-card shadow-[inset_0_0_0_3px_var(--color-surface-raised),inset_0_0_0_4px_var(--color-border-subtle)]',
        avatarUrl && 'grid-cols-[minmax(160px,0.55fr)_minmax(0,1.45fr)] @max-[600px]:grid-cols-1',
      )}>
        {avatarUrl && (
          <div className="relative m-1 mr-0 overflow-hidden rounded-l-[7px] border border-border @max-[600px]:mr-1 @max-[600px]:aspect-[4/3] @max-[600px]:rounded-r-[7px]">
            <img src={avatarUrl} alt={`Retrato de ${name}`} onError={portrait.onError} className="absolute inset-0 size-full object-cover object-top" />
          </div>
        )}

        <div className="grid min-w-0 content-start gap-5 p-6 @max-[480px]:p-4">
          <header className="flex min-w-0 items-center gap-4">
            {!avatarUrl && <Avatar name={name} variant="character" size="xl" />}
            <div className="grid min-w-0 flex-1 gap-1">
              <h2 className="m-0 font-display text-display font-bold tracking-[-0.02em] [overflow-wrap:anywhere] @max-[480px]:text-h1">{name}</h2>
              <p className="m-0 text-body text-text-secondary">{classLine(character)}</p>
            </div>
            <ArmorShield value={character.ac} size="lg" />
          </header>

          {facts.length > 0 && (
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-4 gap-y-3 border-y border-border py-3">
              {facts.map(([label, value]) => (
                <div key={label} className={fact}><dt>{label}</dt><dd className="text-small">{value}</dd></div>
              ))}
            </dl>
          )}

          <dl className="m-0 grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-4 @max-[480px]:grid-cols-3 [&_dd]:font-mono [&_dd]:text-h2 [&_dd]:font-semibold [&_dd]:tabular-nums">
            <div className={cn(fact, '@max-[480px]:col-span-3')}>
              <dt>Pontos de vida{hpTemp > 0 && `, +${hpTemp} temporários`}{down && ', caído'}</dt>
              <dd className={cn(down && 'text-danger-text')}>
                <span aria-hidden="true">{hpCurrent}<span className="text-small font-medium text-text-muted"> / {hp}</span></span>
                <span className="sr-only">{hpLabel(hpCurrent, hp, hpTemp)}</span>
              </dd>
              <HpMeter current={hpCurrent} max={hp} temp={hpTemp} className="order-1 my-1" />
            </div>
            <div className={fact}><dt>Iniciativa</dt><dd>{signed(initiative(character))}</dd></div>
            <div className={fact}><dt>Deslocamento</dt><dd>{formatSpeed(character.speed)}</dd></div>
            <div className={fact}><dt>Percepção passiva</dt><dd>{passivePerception(character)}</dd></div>
          </dl>

          <AbilityRow scores={character.abilityScores} />

          <footer className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-4">
            <p className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-small text-text-secondary">
              Joga em <b className="font-semibold text-foreground [overflow-wrap:anywhere]">{character.campaignName}</b>
              <ActiveBadge active={character.active} />
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={onOpen}>
                <FileText size={16} aria-hidden="true" /> Abrir ficha
              </Button>
              {actions}
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
