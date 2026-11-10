import { ShieldCheck, DiceFive } from '@phosphor-icons/react';
import { Button } from './Button';

function signed(value: number) {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/** Só apresenta valores: os bônus são calculados pelo domínio 5e. */
export function AbilityCard({ label, abbreviation, score, modifier, saveBonus, proficient = false,
  onCheck, onSave, disabled = false }: {
  label: string; abbreviation: string; score: number; modifier: number;
  saveBonus?: number; proficient?: boolean; onCheck?: () => void; onSave?: () => void; disabled?: boolean;
}) {
  return <div role="group" aria-label={label} className="flex min-w-0 flex-col rounded-panel border border-border-strong bg-card p-3 edge-raised">
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"><span className="font-display font-semibold tracking-[0.04em]">{abbreviation}</span><span className="text-small text-text-secondary">{label}</span></div>
    <div className="flex items-center justify-between gap-3 py-3">
      <strong className="font-mono text-display font-medium tracking-[-0.06em] tabular-nums"><span className="sr-only">Modificador </span>{signed(modifier)}</strong>
      <span className="grid min-w-11 justify-items-center rounded-control border border-border bg-background px-2 py-1"><span className="text-micro text-text-muted">Valor</span><b className="font-mono font-medium tabular-nums">{score}</b></span>
    </div>
    {saveBonus !== undefined && <p className="flex items-start gap-1 border-t border-border pt-2 text-small text-text-secondary">
      <ShieldCheck size={16} weight={proficient ? 'fill' : 'regular'} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>Resistência <b className="font-mono">{signed(saveBonus)}</b>{proficient && <small className="block text-micro text-accent-text">Proficiente</small>}</span>
    </p>}
    {(onCheck || onSave) && <div className="mt-auto flex flex-wrap gap-1 pt-3 *:flex-1 *:px-2">
      {onCheck && <Button variant="secondary" disabled={disabled} onClick={onCheck} aria-label={`Teste de ${label}`}>
        <DiceFive size={16} aria-hidden="true" />Teste
      </Button>}
      {onSave && <Button variant="ghost" disabled={disabled} onClick={onSave} aria-label={`Resistência de ${label}`}>
        Resistir
      </Button>}
    </div>}
  </div>;
}
