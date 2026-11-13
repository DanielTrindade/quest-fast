import { cn } from '../lib/utils';

const TONE = { low: 'bg-danger-text', mid: 'bg-accent-text', high: 'bg-success-text' };

/**
 * A glance at hit points: the bar empties as the character takes damage and
 * turns from success to accent to danger. It is decoration; the numbers next
 * to it carry the meaning.
 */
export function HpMeter({ current, max, temp = 0, className }: {
  current: number; max: number; temp?: number; className?: string;
}) {
  const total = Math.max(max + temp, 1);
  const ratio = max > 0 ? current / max : 0;
  const tone = ratio <= 0.25 ? 'low' : ratio <= 0.6 ? 'mid' : 'high';
  return (
    <span aria-hidden="true" data-slot="hp-meter" data-tone={tone}
      className={cn('flex h-1.5 min-w-0 overflow-hidden rounded-full bg-surface-secret shadow-[inset_0_0_0_1px_var(--color-border-subtle)]', className)}>
      <span className={cn('h-full', TONE[tone])} style={{ width: `${Math.min(100, (Math.max(current, 0) / total) * 100)}%` }} />
      {temp > 0 && <span className="h-full bg-text-secondary opacity-70" style={{ width: `${(temp / total) * 100}%` }} />}
    </span>
  );
}
