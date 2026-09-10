import type { ReactNode } from 'react';
import { Notebook, type Icon } from '@phosphor-icons/react';

export function EmptyState({ title, description, action, icon: Symbol = Notebook }: {
  title: string; description: string; action: ReactNode; icon?: Icon;
}) {
  return <div className="qf-empty">
    <span className="qf-empty__symbol"><Symbol size={28} weight="duotone" aria-hidden="true" /></span>
    <h3>{title}</h3><p>{description}</p><div>{action}</div>
  </div>;
}
