import type { Spell } from '@quest-fast/shared';
import { contentKeys } from '../lib/content-keys';
import { circleLabel } from '../lib/sheet-labels';

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
    <div className="qf-spells">
      {levels.map((level) => (
        <section key={level} className="qf-spells__group">
          <h4>{level === 0 ? 'Truques' : circleLabel(level)}</h4>
          <ul className="qf-spells__list">
            {contentKeys(spells.filter((spell) => spell.level === level)).map(({ item: spell, key }) => (
              <li key={key} className="qf-spell">
                <span className="qf-spell__head">
                  <span className="qf-spell__name">{spell.name}</span>
                  <span className="qf-spell__tags">
                    {TAGS.filter((tag) => spell[tag.key]).map((tag) => (
                      <abbr key={tag.key} className="qf-spell__tag" title={tag.label}>
                        <span aria-hidden="true">{tag.short}</span>
                        <span className="sr-only">{tag.label}</span>
                      </abbr>
                    ))}
                  </span>
                </span>
                {(spell.castingTime || spell.range) && (
                  <dl className="qf-spell__meta">
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
                {spell.notes && <p className="qf-spell__notes">{spell.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
