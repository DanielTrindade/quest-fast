import { DiceFive, Sword } from '@phosphor-icons/react';
import { Button } from './Button';

/** A row of "Armas e truques de dano": hit bonus, damage with its type, notes. */
export function AttackCard({ name, bonus, damage, damageType = '', notes = '', onRoll, disabled = false }: {
  name: string; bonus: number; damage: string; damageType?: string; notes?: string; onRoll?: () => void; disabled?: boolean;
}) {
  return <div className="qf-attack">
    <div className="qf-attack__description">
      <p className="qf-attack__name"><Sword size={18} aria-hidden="true" />{name}</p>
      <dl className="qf-attack__stats">
        <div><dt>Acerto</dt><dd>{bonus >= 0 ? '+' : '−'}{Math.abs(bonus)}</dd></div>
        <div><dt>Dano e tipo</dt><dd>{damage}{damageType && <span className="qf-attack__type"> {damageType}</span>}</dd></div>
      </dl>
      {notes && <p className="qf-attack__notes">{notes}</p>}
    </div>
    {onRoll && <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Rolar ataque de ${name}`}>
      <DiceFive size={18} aria-hidden="true" />Rolar ataque
    </Button>}
  </div>;
}
