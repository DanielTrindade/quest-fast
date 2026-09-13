import { DiceFive, Sword } from '@phosphor-icons/react';
import { Button } from './Button';

export function AttackCard({ name, bonus, damage, onRoll, disabled = false }: {
  name: string; bonus: number; damage: string; onRoll?: () => void; disabled?: boolean;
}) {
  return <div className="qf-attack">
    <div className="qf-attack__description">
      <p className="qf-attack__name"><Sword size={18} aria-hidden="true" />{name}</p>
      <dl className="qf-attack__stats">
        <div><dt>Acerto</dt><dd>{bonus >= 0 ? '+' : '−'}{Math.abs(bonus)}</dd></div>
        <div><dt>Dano</dt><dd>{damage}</dd></div>
      </dl>
    </div>
    {onRoll && <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Rolar ataque de ${name}`}>
      <DiceFive size={18} aria-hidden="true" />Rolar ataque
    </Button>}
  </div>;
}
