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
  return <div className="qf-ability" role="group" aria-label={label}>
    <div className="qf-ability__heading"><span>{abbreviation}</span><span>{label}</span></div>
    <div className="qf-ability__values">
      <strong><span className="sr-only">Modificador </span>{signed(modifier)}</strong>
      <span className="qf-ability__score"><span>Valor</span><b>{score}</b></span>
    </div>
    {saveBonus !== undefined && <p className="qf-ability__save">
      <ShieldCheck size={16} weight={proficient ? 'fill' : 'regular'} aria-hidden="true" />
      <span>Resistência <b>{signed(saveBonus)}</b>{proficient && <small>Proficiente</small>}</span>
    </p>}
    {(onCheck || onSave) && <div className="qf-ability__actions">
      {onCheck && <Button variant="secondary" disabled={disabled} onClick={onCheck} aria-label={`Teste de ${label}`}>
        <DiceFive size={16} aria-hidden="true" />Teste
      </Button>}
      {onSave && <Button variant="ghost" disabled={disabled} onClick={onSave} aria-label={`Resistência de ${label}`}>
        Resistir
      </Button>}
    </div>}
  </div>;
}
