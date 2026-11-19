import { useId, useState } from 'react';
import { Sword } from '@phosphor-icons/react';
import type { CombatantView, HitPointMode, HpOperation } from '@quest-fast/shared';
import { Button } from './Button';
import { HealthBand } from './HealthBand';
import { HpAdjuster } from './HpAdjuster';
import { HpMeter } from './HpMeter';
import { SelectField } from './SelectField';
import { Surface } from './Surface';

export type TokenVitalsView = Pick<CombatantView, 'hpCurrent' | 'hpMax' | 'hpTemp' | 'healthBand' | 'defeated'>;

/** "5/7" with the temporary ones after it; the band when the numbers are not known. */
function HitPoints({ vitals }: { vitals: TokenVitalsView }) {
  const { hpCurrent, hpMax, hpTemp } = vitals;
  if (hpCurrent === null || hpMax === null) return <HealthBand band={vitals.healthBand} />;
  return (
    <div className="grid min-w-0 gap-1">
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-small text-text-secondary">
        <span>Pontos de vida</span>
        <span data-down={hpCurrent === 0 || undefined}
          className="font-mono text-body font-semibold text-foreground tabular-nums data-down:text-danger-text">
          {hpCurrent}<span className="text-text-secondary">/{hpMax}</span>
          {!!hpTemp && <span className="text-text-secondary"> +{hpTemp}<span className="sr-only"> temporários</span></span>}
        </span>
        {vitals.defeated && <span className="text-danger-text">Derrotado</span>}
      </p>
      <HpMeter current={hpCurrent} max={hpMax} temp={hpTemp ?? 0} />
    </div>
  );
}

/** A free token from the bestiary, out of the fight: the master puts it in, average or rolled hit points. */
function Join({ name, encounterName, hasFormula, pending, onJoin }: {
  name: string;
  /** The encounter it would join; null when none is open. */
  encounterName: string | null;
  hasFormula: boolean;
  pending: boolean;
  onJoin: (hp: HitPointMode) => void;
}) {
  const [hp, setHp] = useState<HitPointMode>('average');
  if (!encounterName) {
    return <p className="m-0 text-small text-text-secondary">Fora do combate. Crie um encontro em Combate para pôr {name} nele.</p>;
  }
  return (
    <div className="grid min-w-0 gap-2">
      <p className="m-0 text-small text-text-secondary">Fora do combate: sem pontos de vida até entrar em {encounterName}.</p>
      {hasFormula && (
        <SelectField label="Pontos de vida" value={hp} onChange={(value) => setHp(value as HitPointMode)}>
          <option value="average">Média do bestiário</option>
          <option value="rolled">Rolar a fórmula</option>
        </SelectField>
      )}
      <div className="[&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
        <Button variant="secondary" loading={pending} onClick={() => onJoin(hasFormula ? hp : 'average')}>
          <Sword size={18} aria-hidden="true" /> Entrar no combate<span className="sr-only">: {name}</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * The selected token beside the map: its combatant's hit points, with the
 * adjuster for whoever may change them (the master, or the owner of the
 * character). A free token from the bestiary has none yet; the master puts it
 * in the fight instead. Presentational: the screen sends the requests.
 */
export function TokenVitals({ name, vitals, adjust, join }: {
  name: string;
  /** The combatant behind the token, as this viewer sees it; null out of the fight. */
  vitals: TokenVitalsView | null;
  adjust?: { pending: boolean; onApply: (operation: HpOperation, amount: number) => void };
  join?: { encounterName: string | null; hasFormula: boolean; pending: boolean; onJoin: (hp: HitPointMode) => void };
}) {
  const headingId = useId();
  if (!vitals && !join) return null;
  return (
    <Surface className="min-w-0" role="region" aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-3 font-display text-h2 font-semibold [overflow-wrap:anywhere]">{name}</h3>
      <div className="grid min-w-0 gap-3">
        {vitals && <HitPoints vitals={vitals} />}
        {vitals && adjust && (
          <HpAdjuster name={name} pending={adjust.pending}
            full={vitals.hpCurrent !== null && vitals.hpMax !== null && vitals.hpCurrent >= vitals.hpMax}
            onApply={adjust.onApply} />
        )}
        {!vitals && join && <Join name={name} {...join} />}
      </div>
    </Surface>
  );
}
