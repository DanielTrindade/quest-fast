import { motion } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { DiceFive, Hexagon } from '@phosphor-icons/react';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

// Apenas apresenta um resultado recebido. Rolagem e regras pertencem ao servidor/shared.
export function DiceResult({ total, decomposition, dice, mode = 'normal', natural, label = 'Resultado da rolagem' }: {
  total: number; decomposition: string; dice: { value: number; sides: number; discarded?: boolean }[];
  mode?: 'normal' | 'advantage' | 'disadvantage'; natural?: 1 | 20; label?: string;
}) {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
  return <div className="qf-dice" role="group" aria-label={label} data-natural={natural}>
    <p className="qf-dice__label">{label}</p>
    <p className="qf-dice__mode">{{ normal: 'Rolagem normal', advantage: 'Vantagem', disadvantage: 'Desvantagem' }[mode]}</p>
    <ol className="qf-dice__rolls" aria-label="Dados individuais">
      {dice.map((die, index) => <li key={index} data-discarded={die.discarded || undefined}
        aria-label={`d${die.sides}: ${die.value}${die.discarded ? ', descartado' : ''}`}>
        <span className="qf-dice__die-type" aria-hidden="true">
          {die.sides === 20 ? <Hexagon size={16} weight="duotone" /> : <DiceFive size={16} weight="duotone" />}d{die.sides}
        </span>
        <span className="qf-dice__die-value" aria-hidden="true">{die.discarded ? <s>{die.value}</s> : die.value}</span>
        {die.discarded && <small aria-hidden="true">Descartado</small>}
      </li>)}
    </ol>
    <p className="qf-dice__total-label">Total</p>
    <motion.p key={`${total}-${decomposition}-${natural ?? ''}-${mode}`} className="qf-dice__total" data-natural={natural} data-reduced-motion={reduced}
      initial={reduced ? false : { y: natural === 1 ? -10 : 12, scale: natural === 20 ? 1.15 : 0.94 }}
      animate={{ y: 0, scale: 1 }} transition={reduced ? { duration: 0 } : { type: 'spring', duration: 0.7, bounce: 0.24 }}>
      <span className="sr-only">Total: </span>{total}
    </motion.p>
    <p className="qf-dice__decomposition">{decomposition} = {total}</p>
    {natural && <p className="qf-dice__natural" data-natural={natural}>{natural} natural</p>}
  </div>;
}
