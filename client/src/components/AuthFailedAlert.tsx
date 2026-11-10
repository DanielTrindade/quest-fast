import { WarningCircle } from '@phosphor-icons/react';

export function AuthFailedAlert() {
  return (
    <div role="alert" className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-panel border border-s-4 border-danger bg-(--color-danger-surface) p-3">
      <WarningCircle size={20} aria-hidden="true" className="mt-0.5 text-danger-text" />
      <div>
        <strong className="block font-semibold">O Discord não confirmou sua entrada.</strong>
        <span className="mt-1 block text-small text-text-secondary">Se você cancelou a autorização, é só tentar de novo.</span>
      </div>
    </div>
  );
}
