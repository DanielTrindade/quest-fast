import { DiceFive } from '@phosphor-icons/react';

function signed(value: number) {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * A skill with its total bonus, optionally rollable by the owner. Presents
 * only: the bonus is computed by the domain and authorized by the server.
 * Training is marked by the chip's edge and the bonus colour, and spelled out
 * for assistive technology.
 */
export function SkillChip({ label, bonus, trained = false, onRoll, disabled = false }: {
  label: string;
  bonus: number;
  trained?: boolean;
  onRoll?: () => void;
  disabled?: boolean;
}) {
  const className = `qf-skillchip${trained ? ' is-trained' : ''}`;
  const content = (
    <>
      <span className="qf-skillchip__name">
        {label}
        {trained && <span className="sr-only">, treinada</span>}
      </span>
      <span className="qf-skillchip__bonus">
        <span className="sr-only">Bônus </span>
        {signed(bonus)}
      </span>
    </>
  );
  if (!onRoll) return <span className={className}>{content}</span>;
  return (
    <button type="button" className={`${className} qf-skillchip--action`} disabled={disabled} onClick={onRoll}
      aria-label={`Rolar teste de ${label} (${signed(bonus)})`}>
      {content}
      <DiceFive size={16} aria-hidden="true" />
    </button>
  );
}
