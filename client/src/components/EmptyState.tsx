import type { ReactNode } from 'react';
import { Notebook, type Icon } from '@phosphor-icons/react';

export function EmptyState({ title, description, action, icon: Symbol = Notebook }: {
  title: string; description: string; action: ReactNode; icon?: Icon;
}) {
  return <div data-slot="empty" className="grid justify-items-start gap-3 p-6">
    <span className="grid size-14 place-items-center rounded-panel border border-border-strong bg-card text-text-secondary shadow-[inset_0_0_0_3px_var(--color-surface),inset_0_0_0_4px_var(--color-border-subtle)]">
      <Symbol size={28} weight="duotone" aria-hidden="true" />
    </span>
    <h3 className="font-display text-h2 font-semibold">{title}</h3>
    <p className="max-w-[48ch] text-text-secondary">{description}</p>
    <div className="mt-1">{action}</div>
  </div>;
}
