import type { ReactNode } from 'react';
import { FileText } from '@phosphor-icons/react';
import { initiative, passivePerception, type MyCharacter } from '@quest-fast/shared';
import { signed } from '../lib/5e';
import { classLine } from '../lib/character-lines';
import { usePortrait } from '../hooks/usePortrait';
import { cn } from '../lib/utils';
import { hpLabel, isDown } from '../lib/hit-points';
import { formatSpeed } from '../lib/sheet-labels';
import { ArmorShield } from './ArmorShield';
import { Avatar } from './Avatar';
import { HpMeter } from './HpMeter';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

/** Whether this is the character its owner brings to the campaign's table. */
export function ActiveBadge({ active }: { active: boolean }) {
  return active
    ? <Badge variant="accent">Ativo na mesa</Badge>
    : <Badge variant="secondary">Na reserva</Badge>;
}

const fact = 'grid min-w-0 content-start gap-0.5 [&_dd]:m-0 [&_dd]:font-mono [&_dd]:font-semibold [&_dd]:tabular-nums [&_dt]:order-last [&_dt]:text-micro [&_dt]:text-text-muted';

/**
 * A character of the account gallery as a card, the small version of the
 * sheet's head: who it is, the armour class in its shield, hit points and the
 * numbers asked most at the table. `actions` holds what the screen allows.
 */
export function HeroCard({ character, onOpen, actions }: {
  character: MyCharacter; onOpen: () => void; actions?: ReactNode;
}) {
  const { name, hp, hpCurrent, hpTemp } = character;
  const portrait = usePortrait(character.avatarUrl);
  const down = isDown(hpCurrent);
  return (
    <article data-slot="hero-card" aria-label={name}
      className="@container grid min-w-0 content-start overflow-hidden rounded-panel border border-border-strong bg-card shadow-[inset_0_0_0_3px_var(--color-surface-raised),inset_0_0_0_4px_var(--color-border-subtle)]">
      {portrait.src && (
        <img src={portrait.src} alt={`Retrato de ${name}`} onError={portrait.onError}
          className="m-1 mb-0 aspect-[16/10] w-[calc(100%-8px)] rounded-[7px] border border-border object-cover object-top" />
      )}

      <div className="grid min-w-0 gap-4 p-4">
        {/* Narrow, the name gets a row of its own instead of breaking mid-word
            between the token and the shield. */}
        <header className={cn('grid min-w-0 items-center gap-3',
          portrait.src ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-[auto_minmax(0,1fr)_auto] @max-[320px]:grid-cols-[auto_1fr]')}>
          {!portrait.src && <Avatar name={name} variant="character" size="md" />}
          <div className={cn('grid min-w-0 gap-0.5', !portrait.src && '@max-[320px]:col-span-2 @max-[320px]:row-start-2')}>
            <h3 className="m-0 font-display text-h2 font-semibold [overflow-wrap:anywhere]">{name}</h3>
            <p className="m-0 text-small text-text-secondary">{classLine(character)}</p>
          </div>
          <ArmorShield value={character.ac} className={cn(!portrait.src && '@max-[320px]:col-start-2 @max-[320px]:row-start-1 @max-[320px]:justify-self-end')} />
        </header>

        <div className="grid gap-1">
          <p className="m-0 flex items-baseline justify-between gap-2 text-small text-text-muted">
            <span>Pontos de vida{hpTemp > 0 && `, +${hpTemp} temporários`}{down && ', caído'}</span>
            <b className={cn('font-mono font-semibold tabular-nums', down ? 'text-danger-text' : 'text-foreground')}>
              <span aria-hidden="true">{hpCurrent} / {hp}</span>
              <span className="sr-only">{hpLabel(hpCurrent, hp, hpTemp)}</span>
            </b>
          </p>
          <HpMeter current={hpCurrent} max={hp} temp={hpTemp} />
        </div>

        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-3">
          <div className={fact}><dt>Iniciativa</dt><dd>{signed(initiative(character))}</dd></div>
          <div className={fact}><dt>Deslocamento</dt><dd>{formatSpeed(character.speed)}</dd></div>
          <div className={fact}><dt>Percepção passiva</dt><dd>{passivePerception(character)}</dd></div>
        </dl>

        <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-small text-text-secondary">
          Joga em <b className="font-semibold text-foreground [overflow-wrap:anywhere]">{character.campaignName}</b>
          <ActiveBadge active={character.active} />
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onOpen} aria-label={`Abrir ficha de ${name}`}>
            <FileText size={16} aria-hidden="true" /> Abrir ficha
          </Button>
          {actions}
        </div>
      </div>
    </article>
  );
}
