import { Brain, Sparkle, X } from '@phosphor-icons/react';
import type { CombatEffectView } from '@quest-fast/shared';
import { effectDurationShort, effectLabel, effectParts, isWholeEffect } from '../lib/effect-labels';

/** "CA +2, 3 rod.": what the chip adds after the name, short enough for the side panel. */
function detail(effect: CombatEffectView): string | null {
  if (!isWholeEffect(effect)) return null;
  const parts = [...effectParts(effect), effectDurationShort(effect)].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * The temporary effects on a combatant as chips, next to its conditions:
 * the name, then what it changes and how long it lasts. A monster's reaches
 * a player as its name only. `canRemove` decides, per effect, whether its
 * remove button shows; the server checks again. Nothing when there are none.
 */
export function EffectChips({ name, effects, pending = false, canRemove, onRemove }: {
  /** Whose effects: names the list and the buttons for screen readers. */
  name: string;
  effects: CombatEffectView[];
  pending?: boolean;
  canRemove?: (effect: CombatEffectView) => boolean;
  onRemove?: (effectId: string) => void;
}) {
  if (effects.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label={`Efeitos em ${name}`}>
      {effects.map((effect) => {
        const removable = !!onRemove && (canRemove?.(effect) ?? true);
        const extra = detail(effect);
        return (
          <li key={effect.id} data-removable={removable || undefined}
            className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-control border border-border-strong bg-background ps-2 pe-2 text-small text-foreground data-removable:pe-0">
            <Sparkle size={14} aria-hidden="true" className="shrink-0 text-accent-text" />
            {isWholeEffect(effect) && effect.concentration && <Brain size={14} aria-hidden="true" className="shrink-0 text-text-secondary" />}
            <span aria-hidden="true" className="min-w-0 [overflow-wrap:anywhere]">
              <span className="font-semibold">{effect.name}</span>
              {extra && <span className="text-text-secondary"> {extra}</span>}
            </span>
            <span className="sr-only">{effectLabel(effect)}</span>
            {removable && (
              <button type="button" disabled={pending} onClick={() => onRemove!(effect.id)}
                aria-label={`Remover ${effect.name} de ${name}`}
                className="inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-control text-text-secondary transition-[background-color,color] duration-(--duration-quick) hover:not-disabled:bg-muted hover:not-disabled:text-foreground disabled:cursor-not-allowed disabled:opacity-60">
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
