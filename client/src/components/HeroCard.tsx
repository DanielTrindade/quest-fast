import type { ReactNode } from 'react';
import { initiative, passivePerception, type MyCharacter } from '@quest-fast/shared';
import { signed } from '../lib/5e';
import { CharacterPortrait } from './CharacterPortrait';
import { hpLabel } from '../lib/hit-points';
import { HpMeter } from './HpMeter';
import { Badge } from './ui/badge';

const frame = 'border border-border-strong bg-card shadow-[inset_0_0_0_3px_var(--color-surface-raised),inset_0_0_0_4px_var(--color-border-subtle)]';

/** Whether this is the character its owner brings to the campaign's table. */
export function ActiveBadge({ active }: { active: boolean }) {
  return active
    ? <Badge variant="accent">Ativo na mesa</Badge>
    : <Badge variant="secondary">Na reserva</Badge>;
}

/**
 * A character of the account gallery as a card: the portrait, who it is, the
 * hit points and the numbers asked most at the table. Opening it shows the
 * sheet; `actions` holds what the screen allows (activate, go to the table).
 */
export function HeroCard({ character, onOpen, actions }: {
  character: MyCharacter; onOpen: () => void; actions?: ReactNode;
}) {
  const { name, level, hp, hpCurrent, hpTemp } = character;
  return (
    <article data-slot="hero-card" aria-label={name}
      className={`grid min-w-0 content-start overflow-hidden rounded-panel ${frame}`}>
      <button type="button" onClick={onOpen}
        className="group grid min-w-0 cursor-pointer gap-3 bg-transparent p-1.5 pb-0 text-start text-foreground transition-transform duration-(--duration-quick) ease-settle motion-safe:active:scale-[0.99]">
        <span className="relative block">
          <CharacterPortrait name={name} src={character.avatarUrl}
            className="aspect-[4/3.4] rounded-control border border-border transition-[filter] duration-(--duration-quick) group-hover:brightness-110"
            initialsClassName="text-[44px] leading-none" />
          <span className="absolute top-2 left-2 rounded-control border border-border-strong bg-surface-secret px-1.5 py-1 font-mono text-micro font-semibold leading-none">
            NV {level}
          </span>
        </span>
        <span className="grid min-w-0 gap-0.5 px-2">
          <b className="font-display text-h2 font-semibold [overflow-wrap:anywhere]">{name}</b>
          <span className="text-small text-text-muted [overflow-wrap:anywhere]">{character.class} · {character.race}</span>
          <span className="sr-only">Abrir ficha</span>
        </span>
      </button>

      <div className="grid min-w-0 gap-3 px-3 pt-3 pb-3">
        <div className="grid gap-1">
          <p className="m-0 flex justify-between gap-2 text-small text-text-muted">
            <span>Pontos de vida</span>
            <b className="font-mono font-semibold text-foreground tabular-nums">
              <span aria-hidden="true">{hpCurrent}{hpTemp > 0 && ` +${hpTemp}`} / {hp}</span>
              <span className="sr-only">{hpLabel(hpCurrent, hp, hpTemp)}</span>
            </b>
          </p>
          <HpMeter current={hpCurrent} max={hp} temp={hpTemp} />
        </div>

        <dl className="m-0 grid grid-cols-3 border-t border-border pt-2.5 text-center [&>div+div]:border-l [&>div+div]:border-border [&_dd]:m-0 [&_dd]:font-mono [&_dd]:text-h2 [&_dd]:font-semibold [&_dd]:tabular-nums [&_dt]:font-mono [&_dt]:text-micro [&_dt]:tracking-[0.06em] [&_dt]:text-text-muted [&_dt]:uppercase">
          <div className="flex flex-col-reverse"><dt>CA</dt><dd>{character.ac}</dd></div>
          <div className="flex flex-col-reverse"><dt><abbr title="Iniciativa">Inic.</abbr></dt><dd>{signed(initiative(character))}</dd></div>
          <div className="flex flex-col-reverse"><dt><abbr title="Percepção passiva">Perc.</abbr></dt><dd>{passivePerception(character)}</dd></div>
        </dl>

        <div className="flex min-w-0 flex-wrap gap-1">
          <Badge variant="outline" className="max-w-full truncate">{character.campaignName}</Badge>
          <ActiveBadge active={character.active} />
        </div>

        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  );
}
