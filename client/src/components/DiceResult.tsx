import { LazyMotion, domAnimation } from 'motion/react';
import * as m from 'motion/react-m';
import { useSyncExternalStore } from 'react';
import { DiceFive, Hexagon } from '@phosphor-icons/react';
import { contentKeys } from '../lib/content-keys';
import { cn } from '../lib/utils';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

const natural = 'data-[natural=1]:text-danger-text data-[natural=20]:text-accent-text';
const MODE_LABELS = { normal: 'Rolagem normal', advantage: 'Vantagem', disadvantage: 'Desvantagem' };

// The full card centres everything; the compact history row puts the total on the right.
const LAYOUT = {
  full: {
    root: 'justify-items-center border-border-strong p-6 text-center shadow-[inset_0_0_0_3px_var(--color-surface),inset_0_0_0_4px_var(--color-border-subtle)]',
    label: '', mode: '', rolls: 'mt-6 mb-4 justify-center', die: 'min-w-16', value: 'text-h1',
    totalLabel: '', total: 'text-[48px]', decomposition: '', natural: 'px-4',
  },
  compact: {
    root: 'grid-cols-[minmax(0,1fr)_auto] justify-items-start gap-x-3 border-border p-3 text-start',
    label: 'col-start-1 row-start-1 text-small', mode: 'col-start-1 row-start-2', rolls: 'col-span-full row-start-4 mt-3 justify-start',
    die: 'min-w-12', value: 'text-body', totalLabel: 'col-start-2 row-start-1 justify-self-end',
    total: 'col-start-2 row-start-2 justify-self-end text-[28px]', decomposition: 'col-span-full row-start-3', natural: 'col-span-full',
  },
};

type Die = { value: number; sides: number; discarded?: boolean };

function DieChip({ die, valueClass, className }: { die: Die; valueClass: string; className: string }) {
  return <li data-discarded={die.discarded || undefined} aria-label={`d${die.sides}: ${die.value}${die.discarded ? ', descartado' : ''}`}
    className={cn('grid content-start justify-items-center gap-1 rounded-control border border-input bg-popover p-2 font-mono tabular-nums shadow-[inset_0_1px_0_var(--color-edge-light),0_2px_0_var(--color-edge-shadow)] data-discarded:border-border data-discarded:bg-surface-secret data-discarded:text-text-muted data-discarded:shadow-none', className)}>
    <span className="flex items-center gap-1 font-mono text-micro text-text-secondary" aria-hidden="true">
      {die.sides === 20 ? <Hexagon size={16} weight="duotone" /> : <DiceFive size={16} weight="duotone" />}d{die.sides}
    </span>
    <span className={cn('font-semibold', valueClass)} aria-hidden="true">
      {die.discarded ? <s className="decoration-2">{die.value}</s> : die.value}
    </span>
    {die.discarded && <small className="font-sans text-micro" aria-hidden="true">Descartado</small>}
  </li>;
}

// A natural 1 drops in, a 20 lands big; anything else settles from below.
function entrance(nat: 1 | 20 | undefined) {
  return { y: nat === 1 ? -10 : 12, scale: nat === 20 ? 1.15 : 0.94 };
}

// Apenas apresenta um resultado recebido. Rolagem e regras pertencem ao servidor/shared.
export function DiceResult({ total, decomposition, dice, mode = 'normal', natural: nat, label = 'Resultado da rolagem', compact = false }: {
  total: number; decomposition: string; dice: Die[];
  mode?: 'normal' | 'advantage' | 'disadvantage'; natural?: 1 | 20; label?: string; compact?: boolean;
}) {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
  const s = LAYOUT[compact ? 'compact' : 'full'];
  // A history row says each thing once: a normal roll needs no mode label, and
  // a single die is already spelled out by the decomposition.
  const showMode = !compact || mode !== 'normal';
  const showRolls = !compact || dice.length > 1;
  const animate = !reduced && !compact;
  return <div data-slot="dice" role="group" aria-label={label} data-natural={nat} data-compact={compact || undefined}
    className={cn('grid min-w-0 rounded-panel border bg-card', s.root)}>
    <p className={cn('max-w-full font-medium [overflow-wrap:anywhere]', s.label)}>{label}</p>
    {showMode && <p className={cn('text-small text-text-muted', s.mode)}>{MODE_LABELS[mode]}</p>}
    {showRolls && <ol aria-label="Dados individuais" className={cn('m-0 flex list-none flex-wrap gap-2 p-0', s.rolls)}>
      {contentKeys(dice).map(({ item: die, key }) => <DieChip key={key} die={die} valueClass={s.value} className={s.die} />)}
    </ol>}
    <p className={cn('mb-1 text-small text-text-secondary', s.totalLabel)}>Total</p>
    <LazyMotion features={domAnimation}>
      <m.p key={`${total}-${decomposition}-${nat ?? ''}-${mode}`} data-slot="dice-total" data-natural={nat} data-reduced-motion={reduced}
        className={cn('font-mono leading-[1.2] font-medium tabular-nums', natural, s.total)}
        initial={animate ? entrance(nat) : false}
        animate={{ y: 0, scale: 1 }} transition={reduced ? { duration: 0 } : { type: 'spring', duration: 0.7, bounce: 0.24 }}>
        <span className="sr-only">Total: </span>{total}
      </m.p>
    </LazyMotion>
    <p className={cn('mt-2 max-w-full font-mono text-small text-text-muted [overflow-wrap:anywhere]', s.decomposition)}>
      {decomposition} = {total}
    </p>
    {nat && <p data-natural={nat} className={cn('mt-3 border-t border-border-strong pt-2 text-small font-medium', natural, s.natural)}>{nat} natural</p>}
  </div>;
}
