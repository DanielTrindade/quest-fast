import type { ReactNode } from 'react';
import { Notebook } from '@phosphor-icons/react';

export function EmptyState({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <div className="qf-empty">
    <Notebook size={28} weight="regular" aria-hidden="true" />
    <h3>{title}</h3><p>{description}</p><div>{action}</div>
  </div>;
}
