import type { Spell } from '@quest-fast/shared';
import { contentKeys } from '../lib/content-keys';
import { circleLabel } from '../lib/sheet-labels';
import { sheetItem } from './sheet-styles';

const TAGS = [
  { key: 'concentration', short: 'C', label: 'Concentração' },
  { key: 'ritual', short: 'R', label: 'Ritual' },
  { key: 'material', short: 'M', label: 'Material requerido' },
] as const;

/** "Truques e magias preparadas", grouped by circle, cantrips first. */
export function SpellList({ spells }: { spells: readonly Spell[] }) {
  if (spells.length === 0) return <p className="qf-sheet-empty">Nenhuma magia preparada.</p>;

  const levels = [...new Set(spells.map((spell) => spell.level))].sort((a, b) => a - b);
  return (
    <div className="grid gap-4">
      {levels.map((level) => (
        <section key={level} className="grid gap-2">
          <h4 className="m-0 text-small font-semibold text-text-secondary">{level === 0 ? 'Truques' : circleLabel(level)}</h4>
          <ul className="m-0 grid list-none gap-1 p-0">
            {contentKeys(spells.filter((spell) => spell.level === level)).map(({ item: spell, key }) => (
              <li key={key} className={sheetItem}>
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold [overflow-wrap:anywhere]">{spell.name}</span>
                  <span className="inline-flex gap-1">
                    {TAGS.filter((tag) => spell[tag.key]).map((tag) => (
                      <abbr key={tag.key} title={tag.label} className="inline-grid h-6 min-w-6 place-items-center rounded-control border border-input px-1 font-mono text-micro leading-none font-semibold text-text-secondary no-underline">
                        <span aria-hidden="true">{tag.short}</span>
                        <span className="sr-only">{tag.label}</span>
                      </abbr>
                    ))}
                  </span>
                </span>
                {(spell.castingTime || spell.range) && (
                  <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-small [&_dd]:ml-1 [&_dd]:inline [&_dd]:text-text-secondary [&_dt]:inline [&_dt]:text-text-muted">
                    {spell.castingTime && (
                      <div>
                        <dt>Tempo</dt>
                        <dd>{spell.castingTime}</dd>
                      </div>
                    )}
                    {spell.range && (
                      <div>
                        <dt>Alcance</dt>
                        <dd>{spell.range}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {spell.notes && <p className="m-0 text-small [overflow-wrap:anywhere]">{spell.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
